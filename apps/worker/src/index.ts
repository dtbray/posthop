import { submissionSchema, normalizeEmail } from "../../../packages/shared/src/index";
import { MockProvider, Smtp2goProvider } from "../../../packages/smtp2go/src/index";
import { authenticate, HttpError } from "./auth";

type StoredRecipient = {
  id: string;
  batch_id: string;
  email: string;
  state: string;
  attempts: number;
  provider_id: string | null;
  last_error: string | null;
};
type StoredBatch = {
  id: string;
  creator_id: string;
  payload_hash: string;
  subject: string;
  html: string;
  text: string;
  sender_email: string;
  sender_name: string;
  reply_to: string;
  mock: number;
  created_at: string;
};
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/config" && request.method === "GET")
    return json({
      localMock:
        env.APP_ENV === "local" &&
        env.PROVIDER_MODE === "mock" &&
        ["localhost", "127.0.0.1"].includes(url.hostname),
      providerMode: env.PROVIDER_MODE,
      clientId: env.CLIENT_ID,
      tenantId: env.TENANT_ID,
      scope: `api://${env.API_AUDIENCE}/Mail.Send.External`,
    });
  const user = await authenticate(request, env);
  if (url.pathname === "/api/senders" && request.method === "GET")
    return json([{ id: "primary", email: env.SENDER_EMAIL, name: env.SENDER_NAME }]);
  if (url.pathname === "/api/batches" && request.method === "POST") {
    // Bound bytes even if Content-Length is missing or misleading.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Missing body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 450_000) {
        await reader.cancel();
        throw new HttpError(413, "Message too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new HttpError(400, "Invalid JSON");
    }
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpError(400, "Check subject, content, sender, key and exactly one recipient");
    const input = parsed.data;
    const digest = await hash(JSON.stringify(input));
    const existing = await env.DB.prepare(
      "SELECT id, payload_hash FROM batches WHERE creator_id=? AND idempotency_key=?",
    )
      .bind(user, input.idempotencyKey)
      .first<{ id: string; payload_hash: string }>();
    if (existing) {
      if (existing.payload_hash !== digest)
        throw new HttpError(409, "Submission key already used with different content");
      return json({ id: existing.id, duplicate: true }, 200);
    }
    if (env.PROVIDER_MODE !== "mock" && env.PROVIDER_MODE !== "smtp2go")
      throw new HttpError(503, "Provider mode is invalid");
    if (
      !normalizeEmail(env.SENDER_EMAIL) ||
      !normalizeEmail(env.REPLY_TO) ||
      /[\r\n<>]/.test(env.SENDER_NAME)
    )
      throw new HttpError(503, "Sending identity is not configured");
    if (env.PROVIDER_MODE === "smtp2go") {
      if (!env.SMTP2GO_API_KEY) throw new HttpError(503, "Provider is not configured");
      const allowed = env.TEST_RECIPIENTS.split(",").map((v) => normalizeEmail(v));
      if (!allowed.includes(input.recipients[0].email))
        throw new HttpError(403, "Prototype sends only to configured controlled test inboxes");
    }
    const id = crypto.randomUUID(),
      recipientId = crypto.randomUUID();
    // D1 batch is transactional: persist both immutable snapshot and durable work item.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO batches (id,creator_id,idempotency_key,payload_hash,subject,html,text,sender_id,sender_email,sender_name,reply_to,recipient_count,mock)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(creator_id,idempotency_key) DO NOTHING`,
      ).bind(
        id,
        user,
        input.idempotencyKey,
        digest,
        input.subject,
        input.html,
        input.text,
        input.senderId,
        env.SENDER_EMAIL,
        env.SENDER_NAME,
        env.REPLY_TO,
        env.PROVIDER_MODE === "mock" ? 1 : 0,
      ),
      env.DB.prepare(
        `INSERT INTO recipients (id,batch_id,email,personalization) SELECT ?,id,?,? FROM batches WHERE id=?`,
      ).bind(recipientId, input.recipients[0].email, JSON.stringify(input.recipients[0]), id),
    ]);
    const saved = await env.DB.prepare(
      "SELECT id,payload_hash FROM batches WHERE creator_id=? AND idempotency_key=?",
    )
      .bind(user, input.idempotencyKey)
      .first<{ id: string; payload_hash: string }>();
    if (!saved || saved.payload_hash !== digest)
      throw new HttpError(409, "Submission key conflict");
    // Queue enqueue is best effort; cron scans persisted queued rows to repair this gap.
    try {
      if (saved.id === id) await env.DELIVERIES.send({ recipientId });
    } catch {
      /* durable DB outbox remains */
    }
    return json({ id: saved.id, duplicate: saved.id !== id }, 202);
  }
  const submission = url.pathname.match(/^\/api\/submissions\/([0-9a-f-]{36})$/);
  if (submission && request.method === "GET") {
    const saved = await env.DB.prepare(
      "SELECT id FROM batches WHERE creator_id=? AND idempotency_key=?",
    )
      .bind(user, submission[1])
      .first<{ id: string }>();
    return json({ id: saved?.id ?? null });
  }
  const match = url.pathname.match(/^\/api\/batches\/([0-9a-f-]{36})$/);
  if (match && request.method === "GET") {
    const batch = await env.DB.prepare("SELECT * FROM batches WHERE id=? AND creator_id=?")
      .bind(match[1], user)
      .first<StoredBatch>();
    if (!batch) throw new HttpError(404, "Batch not found");
    const r = await env.DB.prepare(
      "SELECT email,state,attempts,provider_id,last_error FROM recipients WHERE batch_id=?",
    )
      .bind(batch.id)
      .first<StoredRecipient>();
    if (!r) throw new HttpError(500, "Batch recipient missing");
    const state =
      r.state === "provider_accepted"
        ? "completed"
        : r.state === "rejected"
          ? "completed_with_failures"
          : r.state === "unknown"
            ? "needs_review"
            : r.state === "queued"
              ? "submitted"
              : "processing";
    return json({
      id: batch.id,
      subject: batch.subject,
      created_at: batch.created_at,
      state,
      recipient: r,
      mock: Boolean(batch.mock),
    });
  }
  throw new HttpError(404, "API route not found");
}

export async function deliver(recipientId: string, env: Env) {
  const claimed = await env.DB.prepare(
    `UPDATE recipients SET state='attempting', attempts=attempts+1, updated_at=datetime('now')
    WHERE id=? AND state IN ('queued','deferred') AND next_attempt_at<=datetime('now') RETURNING *`,
  )
    .bind(recipientId)
    .first<StoredRecipient>();
  if (!claimed) return;
  const batch = await env.DB.prepare("SELECT * FROM batches WHERE id=?")
    .bind(claimed.batch_id)
    .first<StoredBatch>();
  if (!batch) throw new Error("Missing batch");
  // Mode changes must never convert a mock submission into real mail.
  if (
    !batch.mock &&
    (env.PROVIDER_MODE !== "smtp2go" ||
      !env.SMTP2GO_API_KEY ||
      !env.TEST_RECIPIENTS.split(",").map(normalizeEmail).includes(claimed.email))
  ) {
    await env.DB.prepare(
      "UPDATE recipients SET state='rejected',last_error='Live test configuration unavailable',updated_at=datetime('now') WHERE id=?",
    )
      .bind(recipientId)
      .run();
    return;
  }
  const provider = batch.mock ? new MockProvider() : new Smtp2goProvider(env.SMTP2GO_API_KEY!);
  const result = await provider.send({
    recipient: claimed.email,
    sender: batch.sender_email,
    senderName: batch.sender_name,
    replyTo: batch.reply_to,
    subject: batch.subject,
    html: batch.html,
    text: batch.text,
    batchId: batch.id,
    recipientId,
  });
  const retry = result.kind === "retry" && claimed.attempts < Number(env.MAX_ATTEMPTS);
  const state =
    result.kind === "accepted"
      ? "provider_accepted"
      : retry
        ? "deferred"
        : result.kind === "unknown"
          ? "unknown"
          : "rejected";
  await env.DB.prepare(
    `UPDATE recipients SET state=?,provider_id=?,last_error=?,next_attempt_at=datetime('now',?),updated_at=datetime('now') WHERE id=? AND state='attempting'`,
  )
    .bind(
      state,
      result.kind === "accepted" ? result.providerId : null,
      result.kind === "accepted" ? null : result.reason,
      `+${Math.min(3600, 60 * 2 ** claimed.attempts)} seconds`,
      recipientId,
    )
    .run();
}

export default {
  async fetch(request, env) {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) return await api(request, env);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : "Internal error; retry submission with the same key",
        },
        error instanceof HttpError ? error.status : 500,
      );
    }
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      const body = message.body;
      if (
        typeof body !== "object" ||
        body === null ||
        !("recipientId" in body) ||
        typeof body.recipientId !== "string"
      ) {
        message.ack();
        continue;
      }
      try {
        await deliver(body.recipientId, env);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 120 });
      }
    }
  },
  async scheduled(_event, env) {
    // A crashed send may have reached SMTP2GO. Never return stale claims to the queue.
    await env.DB.prepare(
      "UPDATE recipients SET state='unknown',last_error='Interrupted send; reconcile with provider before any resend',updated_at=datetime('now') WHERE state='attempting' AND updated_at<datetime('now','-5 minutes')",
    ).run();
    const pending = await env.DB.prepare(
      "SELECT id FROM recipients WHERE state IN ('queued','deferred') AND next_attempt_at<=datetime('now') LIMIT 100",
    ).all<{ id: string }>();
    for (const r of pending.results) await env.DELIVERIES.send({ recipientId: r.id });
  },
} satisfies ExportedHandler<Env>;
