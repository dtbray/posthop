# Architecture and contracts

Outlook editor → Office.js snapshot → user review → authenticated Worker → D1 batch + recipient → Queue → conditional recipient claim → SMTP2GO HTTPS → provider acceptance. The browser never loops over delivery work. A five-minute scheduled handler repairs queued/deferred work and quarantines stale attempting claims.

`POST /api/batches` accepts `{idempotencyKey, senderId:"primary", subject, html, text, recipients:[{email, firstName?, lastName?}]}`. Phase 1 enforces exactly one recipient and a 450 KB request limit. Successful creation returns 202 `{id}` only after D1 commit. Duplicate identical submission returns 200/202 with the original ID; conflicting content returns 409. The key must be reused on uncertain HTTP outcomes.

`GET /api/batches/:id` requires the same authorized creator. Returns subject, timestamp, processing state, recipient acceptance state, attempts, generic error and provider ID. It excludes body content. `GET /api/submissions/:key` recovers a creator-owned batch ID when a prepared draft is reopened. `GET /api/senders` is authenticated; sender addresses never come from the submission. `GET /api/config` exposes only public auth configuration.

The compose snapshot includes HTML and Office-produced plain text. Preview HTML is sanitized and rendered in a sandboxed iframe with a restrictive document CSP, no remote images, scripts, forms or navigation. Stored HTML is the Outlook source snapshot for delivery, not preview-normalized markup. No CSV file is uploaded or retained.

## Implemented states

| Recipient         | Batch processing state  | Meaning                                                |
| ----------------- | ----------------------- | ------------------------------------------------------ |
| queued            | submitted               | D1 committed; queue trigger pending                    |
| attempting        | processing              | Durable claim; provider call may have started          |
| deferred          | processing              | Definite rate limit; next retry has a durable due time |
| provider_accepted | completed               | SMTP2GO accepted processing; not proof of delivery     |
| rejected          | completed_with_failures | Definite provider refusal or exhausted safe retries    |
| unknown           | needs_review            | Acceptance uncertain; automatic resend prohibited      |

The batch status is derived from its single recipient; no redundant mutable batch-state column exists in phase 1. Delivery events table is reserved for phase 3 and remains unused. User/sending identity tables are reserved for a later admin path; current creator IDs are tenant+object ID claims and senders are server configuration.

## Planned bulk states

Prepared is a client review stage, not a submitted batch. Submitted means a full immutable batch and all its work are durable. Processing means at least one recipient has started or is deferred. Completed means all recipients have finished processing without failures or unknown outcomes, regardless of eventual delivery. Completed with failures means processing is terminal with at least one permanent refusal/bounce; failed is reserved for batch-wide unrecoverable validation/configuration failure. Needs review overrides aggregate completion for ambiguous attempts. Cancelled stops unclaimed work only; attempting/accepted messages cannot be recalled.

Delivery and engagement will be separate projections. Recipient transport states will add delivered, bounced, rejected and suppression/complaint outcomes using verified webhook data. Opens/clicks are events, never replacements for a bounce/rejection. Later delivered events cannot erase permanent failures without a documented correction model. Store event time and ingestion time independently, and deduplicate robustly before state projection.

## Security boundary

JWT validation checks RS256 signatures against tenant-specific Microsoft JWKS, issuer, audience, expiry, tenant ID, authorized client ID (`azp`), delegated `Mail.Send.External` scope and object-ID allowlist. No Graph or Outlook mailbox token is accepted as an application token. Secrets are Worker-only bindings. Mock authentication additionally requires local configuration, mock mode and a loopback request hostname; it never authorizes live SMTP2GO calls.

Phase 2 must add atomic daily/monthly reservations, per-user limits and suppression policy before broadening the recipient limit. Queue max concurrency is currently 1. See the [ADR](decisions/0001-independent-mailer.md).
