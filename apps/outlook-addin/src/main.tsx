import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Checkbox,
  Field,
  FluentProvider,
  Input,
  MessageBar,
  Spinner,
  Textarea,
  webLightTheme,
} from "@fluentui/react-components";
import DOMPurify from "dompurify";
import {
  normalizeEmail,
  parseRecipients,
  type BatchStatus,
} from "../../../packages/shared/src/index";
import { accessToken, type Config } from "./auth";
import { prepareDraft, readDraft, properties, type Draft } from "./office";
import "./style.css";
const sample: Draft = {
  subject: "Your event arrival instructions",
  html: "<h2>We look forward to seeing you</h2><p>Please arrive 15 minutes before the event. Reply to this email if you need help.</p>",
  text: "We look forward to seeing you. Please arrive 15 minutes before the event. Reply to this email if you need help.",
};
function App() {
  const [config, setConfig] = useState<Config>();
  const [inOutlook, setInOutlook] = useState(false);
  const [draft, setDraft] = useState<Draft>();
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [sender, setSender] = useState("");
  const [csv, setCsv] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState<BatchStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imported = csv ? parseRecipients(csv) : undefined;
  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    if (!config) throw new Error("Loading configuration");
    const token = await accessToken(config);
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const body: unknown = await response.json();
    if (!response.ok)
      throw new Error(
        typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "string"
          ? body.error
          : "Request failed",
      );
    return body as T;
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void fetch("/api/config")
      .then(async (r) => (await r.json()) as Config)
      .then(setConfig)
      .catch(() => setError("Could not load backend configuration."));
    const timer = setTimeout(
      () =>
        setError(
          "Office initialization is taking longer than expected. Local mock mode can be used in a browser.",
        ),
      10000,
    );
    if (typeof Office === "undefined" || typeof Office.onReady !== "function") {
      clearTimeout(timer);
      setError("The Outlook library could not load. Check your connection and reopen Posthop.");
      return () => clearTimeout(timer);
    }
    void Office.onReady()
      .then(async (info) => {
        clearTimeout(timer);
        const outlookHost = Office.HostType?.Outlook;
        if (outlookHost !== undefined && info?.host === outlookHost) {
          setInOutlook(true);
          try {
            const p = await properties();
            const saved: unknown = p.get("posthopSubmissionKey");
            if (typeof saved === "string") {
              setKey(saved);
            }
          } catch {
            setError("Could not read draft tracking. Preparation must succeed before sending.");
          }
        }
      })
      .catch(() => {
        clearTimeout(timer);
        setError("Outlook could not initialize. Reopen Posthop from a compose window.");
      });
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!config?.localMock) return;
    void action(async () => {
      const identities = await api<{ name: string; email: string }[]>("/api/senders");
      setSender(`${identities[0].name} <${identities[0].email}>`);
    });
  }, [config]);
  useEffect(() => {
    if (!key || !sender) return;
    void action(async () => {
      const saved = await api<{ id: string | null }>(`/api/submissions/${key}`);
      if (saved.id) {
        setBatchId(saved.id);
        setStatus(await api<BatchStatus>(`/api/batches/${saved.id}`));
      }
    });
  }, [key, sender]);
  async function prepare() {
    await action(async () => {
      if (inOutlook) {
        const prepared = await prepareDraft();
        setDraft(prepared.draft);
        setKey(prepared.key);
      } else if (config?.localMock) {
        setDraft(sample);
        const k = localStorage.getItem("posthop-demo-key") ?? crypto.randomUUID();
        localStorage.setItem("posthop-demo-key", k);
        setKey(k);
      } else throw new Error("Open the task pane from Outlook compose.");
      setConfirmed(false);
    });
  }
  async function refreshStatus() {
    await action(async () => {
      if (batchId) setStatus(await api<BatchStatus>(`/api/batches/${batchId}`));
    });
  }
  return (
    <FluentProvider theme={webLightTheme}>
      <main>
        <header>
          <span className="eyebrow">OUTLOOK EXTERNAL MAILER · PROTOTYPE</span>
          <h1>Send with confidence</h1>
          <p>Compose in Outlook. Submit through SMTP2GO.</p>
        </header>
        <MessageBar intent="warning">
          External sending leaves your Outlook draft open. It does not create an Exchange Sent Items
          copy. Do not also press Outlook’s Send button.
        </MessageBar>
        {config?.providerMode === "mock" && (
          <MessageBar intent="info">
            {config.localMock
              ? "Local simulation. No email will be delivered."
              : "Mock delivery. No email will be delivered."}
          </MessageBar>
        )}
        {error && <MessageBar intent="error">{error}</MessageBar>}
        {config && !config.localMock && !inOutlook && (
          <MessageBar intent="info">
            This is the task pane preview. Open Posthop from an Outlook compose window to sign in
            and read a draft.
          </MessageBar>
        )}
        {config && !config.localMock && !sender && (
          <Button
            disabled={!inOutlook || busy}
            onClick={() =>
              void action(async () => {
                const identities = await api<{ name: string; email: string }[]>("/api/senders");
                setSender(`${identities[0].name} <${identities[0].email}>`);
              })
            }
          >
            Sign in to Microsoft
          </Button>
        )}
        <section>
          <h2>1. Prepare your message</h2>
          <p>
            This button saves a submission tracking key in the draft’s add-in properties. It does
            not change the subject or body. A prepared draft keeps the same key when reopened.
          </p>
          <Button
            disabled={busy || !sender || !!batchId || (!inOutlook && !config?.localMock)}
            onClick={() => void prepare()}
          >
            Prepare {inOutlook ? "Outlook draft" : "sample draft"}
          </Button>
          {draft && (
            <>
              <h3>{draft.subject}</h3>
              <iframe
                title="Read-only message preview"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{font:14px system-ui;padding:8px;overflow-wrap:anywhere}</style>${DOMPurify.sanitize(draft.html)}`}
              />
            </>
          )}
          <Field label="Configured sender">
            <Input value={sender} readOnly />
          </Field>
        </section>
        <section>
          <h2>2. Choose a test recipient</h2>
          <p>
            One recipient per submission in this prototype. Live delivery is restricted to the
            administrator’s test inbox allowlist.
          </p>
          <Field label="Recipient email">
            <Input
              value={email}
              disabled={!!batchId}
              onChange={(_, d) => {
                setEmail(d.value);
                setConfirmed(false);
              }}
            />
          </Field>
          <details>
            <summary>Inspect a CSV export</summary>
            <p>Import and correct rows below. Bulk submission is planned for phase 2.</p>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Import recipient CSV"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1_000_000) {
                    setError("CSV exceeds 1 MB.");
                    return;
                  }
                  void file.text().then(setCsv);
                }
              }}
            />
            <Field label="Editable CSV">
              <Textarea value={csv} onChange={(_, d) => setCsv(d.value)} />
            </Field>
            {imported && (
              <>
                <p>
                  {imported.recipients.length} valid unique recipients ·{" "}
                  {imported.duplicates.length} duplicate rows
                </p>
                {imported.errors.map((e, i) => (
                  <p className="error" key={i}>
                    {e}
                  </p>
                ))}
                {imported.duplicates.length > 0 && (
                  <p>Duplicate rows: {imported.duplicates.join(", ")}</p>
                )}
                <ul>
                  {imported.recipients.map((r) => (
                    <li key={r.email}>
                      <Button
                        size="small"
                        disabled={!!batchId || imported.errors.length > 0}
                        onClick={() => {
                          setEmail(r.email);
                          setConfirmed(false);
                        }}
                      >
                        Select {r.email}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </details>
        </section>
        <section>
          <h2>3. Review and submit</h2>
          <p>
            Estimated messages: {normalizeEmail(email) ? 1 : 0}. Attachments and inline images are
            unsupported.
          </p>
          <Checkbox
            checked={confirmed}
            disabled={!draft || !!batchId}
            onChange={(_, d) => setConfirmed(d.checked === true)}
            label={`I reviewed “${draft?.subject ?? "the message"}” for ${email || "one recipient"}, and these are authorized event instructions. I understand this leaves the Outlook draft open.`}
          />
          <Button
            appearance="primary"
            disabled={busy || !draft || !key || !confirmed || !normalizeEmail(email) || !!batchId}
            onClick={() =>
              void action(async () => {
                if (!draft) return;
                if (inOutlook && JSON.stringify(await readDraft()) !== JSON.stringify(draft)) {
                  setConfirmed(false);
                  throw new Error(
                    "Draft changed. Prepare and review the updated message before sending.",
                  );
                }
                const result = await api<{ id: string }>("/api/batches", {
                  method: "POST",
                  body: JSON.stringify({
                    idempotencyKey: key,
                    senderId: "primary",
                    ...draft,
                    recipients: [{ email: normalizeEmail(email) }],
                  }),
                });
                setBatchId(result.id);
                setStatus(await api<BatchStatus>(`/api/batches/${result.id}`));
              })
            }
          >
            {config?.providerMode === "mock" ? "Submit simulated message" : "Send via SMTP2GO"}
          </Button>
          {busy && <Spinner size="tiny" label="Working…" />}
          {batchId && (
            <div role="status">
              <h3>Durably submitted</h3>
              <p>You can close Outlook. Your draft remains open and must not be sent again.</p>
              <p>
                Batch <code>{batchId}</code>
              </p>
              <p>Submission persisted. Processing status: {status?.state ?? "refresh required"}</p>
              {status && (
                <>
                  <p>Recipient: {status.recipient.email}</p>
                  <p>
                    Provider accepted: {status.recipient.state === "provider_accepted" ? 1 : 0} ·
                    Delivery: not yet reported
                  </p>
                  <p>{status.recipient.last_error}</p>
                  <p>Provider ID: {status.recipient.provider_id ?? "pending"}</p>
                </>
              )}
              <Button onClick={() => void refreshStatus()} disabled={busy}>
                Refresh status
              </Button>{" "}
              <a href="https://app.smtp2go.com/" target="_blank" rel="noreferrer">
                SMTP2GO reports
              </a>
            </div>
          )}
          {key && !batchId && (
            <p className="muted">
              Tracking key: <code>{key}</code>. Reopening this draft reuses its key; a repeated
              submission returns its original batch. Changed content with an already used key is
              blocked.
            </p>
          )}
        </section>
        <footer>
          Accepted for processing does not mean delivered. SMTP2GO is the primary delivery reporting
          tool.
        </footer>
      </main>
    </FluentProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
