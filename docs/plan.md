# Delivery plan

## Phase 0: completed documentation review

Feasibility and ADR capture supported compose APIs, NAA, manifest hosting, SMTP2GO acceptance/webhooks, unknown-result handling and cost boundaries. Account-specific capabilities still need controlled validation.

## Phase 1: local prototype delivered, integrations pending

Implemented: task pane, subject/HTML/text extraction, explicit draft tracking, Entra token-validation boundary, server-configured sender, persistent single-recipient batch/outbox, Queue consumer, status endpoint, SMTP2GO adapter and mock path. Credentials are unavailable; neither Outlook tenant execution nor real email delivery is claimed complete. See `testing.md` for the controlled end-to-end gate.

## Phase 2: minimum usable bulk product

1. Replace the one-recipient constraint with configurable limits and transactional insertion/chunking suitable for D1 binding/query limits. Preserve recipient-source interface and frozen batch payloads. Persist first/last names without enabling unrelated personalization tools.
2. Extend CSV review to the complete send list: row editing/exclusion with explicit acknowledgement, invalid/duplicate reporting and representative Square exports. Current parser recognizes common Customer Directory headers; do not claim every Square order export is supported.
3. Add atomic provider daily/monthly capacity reservations, configurable reset periods, per-user submission limits, configurable worker concurrency and retry ceilings. Count attempting/unknown conservatively against capacity; prevent races across consumers. Default allowances must be configuration, with preflight warnings about delayed delivery and event deadlines.
4. Add durable prepared/submitted/processing/completed/failure/cancelled aggregation and cancellation of unclaimed work. Add batch history and status links; preserve the existing recovered-status lookup when reopening a prepared draft. Require explicit review of partial failures.
5. Test browser closure, Worker crash boundaries, queue expiry/replay, SQL rollback, multi-recipient partial failure, quotas under concurrency, per-recipient retry due times and exhausted retries. Continue holding unknown outcomes rather than automatically resending.

Exit: the minimum usable product sends an authorized CSV list individually, can resume safe work, and clearly differentiates external submission from Exchange delivery. Do not enable customer bulk sending until these gates pass.

## Phase 3: delivery diagnostics

Configure documented JSON webhooks with a separate high-entropy bearer credential. Validate the real controlled event schema before implementation, including custom-header shape, timestamp formats and whether `id` identifies a delivery occurrence or webhook configuration. Authenticate before parsing. Enforce payload bounds; deduplicate fingerprints including event kind/time/email ID and stable relevant fields. Store minimal metadata. Preserve delivery outcomes separately from open/click engagement and tolerate event reordering.

Correlate by provider email ID and configured opaque headers; handle an event arriving before the send response. Show attention-needed recipients, delivered/bounced/rejected counts, complaints and suppression outcomes. Add a privileged audited retry action for proven unaccepted, non-permanent failures only; unresolved unknowns and hard bounces remain blocked. Document provider reporting search, tracking caveats and retention. Implement cascading expiry and deletion audit without retaining unnecessary PII.

Exit: controlled webhook replay/reordering tests pass, suppression is respected and staff can find failures without interpreting opens as delivery evidence.

## Phase 4: production gate

Complete tenant/NAA/browser/HTTPS validation, nontechnical onboarding, domain authentication/reply routing, config/secrets validation, reproducible authorized deployment, monitoring/alerts, PII retention, rotation, backups and restore reconciliation. Add Playwright coverage of review, errors and durable outcomes plus documented live Outlook test. Confirm SMTP2GO acceptable-use fit and required consent/contact/opt-out behavior with the business/provider. Review actual pricing and quotas for event sizes. Production deployment, tenant changes, DNS changes, paid services and customer email require explicit authorization.

Square API work is a separate future milestone after the reliable mailer works. No CRM, marketing automation, attachments or scheduling enters these phases.
