import { beforeAll, afterAll, describe, it, expect } from "vite-plus/test";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
let mf: Miniflare;
beforeAll(async () => {
  const compiled = await build({
    stdin: {
      contents: `import worker from './apps/worker/src/index.ts'; export default { ...worker, async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname==='/test/recover'){await worker.scheduled({},env,ctx);return new Response('ok');}return worker.fetch(req,env,ctx);} };`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: compiled.outputFiles[0].text,
      compatibilityDate: "2026-07-01",
      d1Databases: ["DB"],
      queueProducers: { DELIVERIES: "delivery" },
      queueConsumers: { delivery: { maxBatchSize: 1 } },
      bindings: {
        APP_ENV: "local",
        PROVIDER_MODE: "mock",
        DEV_AUTH_TOKEN: "local-development-only",
        TENANT_ID: "",
        API_AUDIENCE: "",
        CLIENT_ID: "",
        ALLOWED_OBJECT_IDS: "",
        SENDER_EMAIL: "sender@example.com",
        SENDER_NAME: "Event team",
        REPLY_TO: "reply@example.com",
        TEST_RECIPIENTS: "",
        MAX_ATTEMPTS: "3",
      },
    }),
  );
  const db = await mf.getD1Database("DB");
  const sql = (await readFile("db/migrations/0001_initial.sql", "utf8")).replace(/--[^\n]*/g, "");
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
});
afterAll(async () => {
  await mf?.dispose();
});
const input = (idempotencyKey = crypto.randomUUID()) => ({
  idempotencyKey,
  senderId: "primary",
  subject: "Event instructions",
  html: "<p>Hello</p>",
  text: "Hello",
  recipients: [{ email: "test@example.com" }],
});
async function submit(body: unknown, token = "local-development-only") {
  return mf.dispatchFetch("http://localhost/api/batches", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
async function batchId(response: { json(): Promise<unknown> }) {
  const b = (await response.json()) as { id: string };
  expect(b.id).toBeTruthy();
  return b.id;
}
async function status(id: string) {
  const r = await mf.dispatchFetch(`http://localhost/api/batches/${id}`, {
    headers: { Authorization: "Bearer local-development-only" },
  });
  return r.json() as Promise<{
    state: string;
    recipient: { state: string; attempts: number; provider_id: string };
  }>;
}
describe("Worker + real local D1 + queue", () => {
  it("rejects missing/bad authentication and forged sender/bulk submission", async () => {
    expect((await mf.dispatchFetch("http://localhost/api/batches")).status).toBe(401);
    expect((await submit(input(), "bad")).status).toBe(503);
    expect((await submit({ ...input(), senderId: "forged" })).status).toBe(400);
    expect(
      (
        await submit({
          ...input(),
          recipients: [{ email: "a@example.com" }, { email: "b@example.com" }],
        })
      ).status,
    ).toBe(400);
  });
  it("persists immutable submissions and returns the original ID for concurrent duplicates", async () => {
    const payload = input();
    const responses = await Promise.all([submit(payload), submit(payload)]);
    expect(responses.every((r) => [200, 202].includes(r.status))).toBe(true);
    const ids = await Promise.all(responses.map(batchId));
    expect(ids[0]).toBe(ids[1]);
    expect((await submit({ ...payload, subject: "Changed" })).status).toBe(409);
    const db = await mf.getD1Database("DB");
    expect(
      (
        await db
          .prepare("SELECT count(*) AS n FROM recipients WHERE batch_id=?")
          .bind(ids[0])
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });
  it("processes without browser polling, and duplicate queue messages do not resend", async () => {
    const id = await batchId(await submit(input()));
    await expect.poll(async () => (await status(id)).recipient.state).toBe("provider_accepted");
    const db = await mf.getD1Database("DB");
    const row = await db
      .prepare("SELECT id FROM recipients WHERE batch_id=?")
      .bind(id)
      .first<{ id: string }>();
    const queue = await mf.getQueueProducer("DELIVERIES");
    await queue.send({ recipientId: row!.id });
    expect((await status(id)).recipient.attempts).toBe(1);
    expect((await status(id)).state).toBe("completed");
    expect((await status(id)).recipient.provider_id).toMatch(/^mock-/);
  });
  it("does not expose another creator’s batch", async () => {
    const id = await batchId(await submit(input()));
    const db = await mf.getD1Database("DB");
    await db.prepare("UPDATE batches SET creator_id='someone-else' WHERE id=?").bind(id).run();
    expect(
      (
        await mf.dispatchFetch(`http://localhost/api/batches/${id}`, {
          headers: { Authorization: "Bearer local-development-only" },
        })
      ).status,
    ).toBe(404);
  });
  it("repairs queued work after enqueue failure and quarantines interrupted sends", async () => {
    const id = await batchId(await submit(input()));
    await expect.poll(async () => (await status(id)).recipient.state).toBe("provider_accepted");
    const db = await mf.getD1Database("DB");
    await db
      .prepare(
        "UPDATE recipients SET state='queued',attempts=0,next_attempt_at=datetime('now') WHERE batch_id=?",
      )
      .bind(id)
      .run();
    await mf.dispatchFetch("http://localhost/test/recover");
    await expect.poll(async () => (await status(id)).recipient.state).toBe("provider_accepted");
    await db
      .prepare(
        "UPDATE recipients SET state='attempting',updated_at=datetime('now','-10 minutes') WHERE batch_id=?",
      )
      .bind(id)
      .run();
    await mf.dispatchFetch("http://localhost/test/recover");
    expect((await status(id)).recipient.state).toBe("unknown");
    expect((await status(id)).state).toBe("needs_review");
    await mf.dispatchFetch("http://localhost/test/recover");
    expect((await status(id)).recipient.state).toBe("unknown");
  });
});
