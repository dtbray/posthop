# ADR 0001: Independent Outlook pane and durable external delivery

Status: accepted for prototype, 2026-10-23.

## Decision

Use a React/Fluent UI compose task pane, add-in-only XML manifest, Microsoft NAA/MSAL and a tenant-specific delegated API scope. Serve static assets and authenticated API from one Cloudflare Worker. Use D1 as the authoritative immutable submission/outbox store and Queues to trigger individual delivery. SMTP2GO is behind a small typed adapter; mock and live modes share the same path.

The first milestone accepts exactly one recipient. Live mode requires a controlled-test recipient allowlist. This deliberately does not constitute the bulk MVP. No BiFrost, Graph mail transport, SMTP relay, Square API, attachment handling or custom analytics product is introduced.

## Reliability contract

- A client key is saved via supported custom properties only when staff explicitly prepare a draft. It is unique per prepared draft. A batch is unique by authenticated creator and key. Same key/content returns the same batch; changed content returns 409.
- A D1 transactional batch stores the frozen message plus queued recipient. Queue failure after commit does not invalidate the durable acknowledgement: a scheduled outbox sweep repairs it.
- A conditional SQL claim changes queued/deferred to attempting before network I/O. Duplicate queue triggers cannot reclaim an active or finished send.
- Only definite HTTP 429 failures defer for bounded exponential retry (120 seconds, then 240, maximum configured attempts). No generic network/server-error retry.
- Timeout, transport failure, malformed success or server error becomes unknown. A crash between claim and storing the result also becomes unknown after five minutes. Unknown is a manual reconciliation state; it is not a safe-to-retry failure.
- SMTP2GO custom headers contain only opaque batch/recipient IDs. They support correlation, not provider idempotency. No exactly-once external-delivery claim is made.
- After external acceptance, processing is complete but delivery remains unreported until provider events exist. No Exchange Sent Items write is attempted.

## Consequences

The DB/queue dual-write gap is recoverable without a complex workflow service. A small cron scan has low cost but can delay repair by up to five minutes plus scheduling lag. Ambiguous sends can require human review, including some cases where no email actually left the Worker; avoiding duplicate event instructions takes priority over automatic recovery. Queues can expire independently of D1; the outbox remains authoritative.

The prototype keeps authorization and sender identity in deployment configuration. The initial users/sending-identities tables reserve the requested small administrative model but are not yet populated by the app. Production needs quotas, retention, operational monitoring, verified-domain onboarding and authenticated webhook tests before enabling bulk delivery.
