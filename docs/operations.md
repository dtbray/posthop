# Staff workflow and operations

## Staff: controlled prototype

1. Compose a **new** Outlook message with a subject and body. Do not add attachments or pasted inline images. The prototype does not import Outlook To/Cc/Bcc fields; choose the one intended recipient in the pane.
2. Open Posthop in the compose ribbon. Choose Prepare Outlook draft. This saves a tracking key in the draft's add-in properties and reads its content.
3. Check the preview and configured sender. Enter the approved test inbox. CSV inspection can help select one address; correct every invalid row before selecting from an import.
4. Review the subject, recipient and authorized-message confirmation. Choose Send via SMTP2GO (or Submit simulated message locally).
5. Wait for **Durably submitted** and keep the batch ID. You can close Outlook. Do not also click Outlook Send: the draft remains in Outlook and there is no Exchange Sent Items copy.
6. Refresh status. Provider accepted means processing accepted, not delivery. Open SMTP2GO Reports > Activity and search using the provider email ID; otherwise use exact recipient and submission time. The dashboard supports richer diagnostics than this prototype. Custom batch-header dashboard search/deep linking has not been verified.

A prepared draft reuses its tracking key when reopened. Repeating its identical submission returns the existing batch. The key cannot be used for changed content; compose a new draft for a genuinely new send. Do not create a new draft to work around an uncertain send without first checking provider records.

## Troubleshooting

- Authentication not configured: administrator must complete Entra setup. A valid mailbox address alone cannot authorize access.
- Unauthorized sender/recipient: this prototype uses a single server-configured verified sender and controlled-test inboxes only.
- Submission request interrupted: reuse the same draft/key; never generate a replacement key just because the browser timed out.
- Submitted/queued: check consumer health and cron. DB rows survive queue expiration and are republished by the repair sweep.
- Deferred: known rate limit. Wait for the scheduled retry; inspect provider/account rate limits. Exhausted safe retries appear as rejection.
- Unknown/needs review: check SMTP2GO for recipient/time, provider ID if available, and correlation headers via an authorized support/API investigation. Do not reset database state to queued or resend blindly. The prototype has no manual retry button. If absence of acceptance cannot be proven, retain the unknown state and contact support/use another operational communication channel.
- Hard bounce, rejection or suppressed recipient in provider reports: correct the underlying address or use another contact channel; do not bypass suppression. Local webhook diagnostics are not implemented yet.

## Tracking and privacy

Successful submission is not delivery. Delivered means recipient-server acceptance, not inbox placement. Open tracking is approximate and affected by privacy protections; scanners can trigger clicks. Lack of an open does not prove an unread message. For event instructions, address delivery failures before interpreting engagement.

No CSV files are stored server-side. Bodies and recipient addresses live in D1 for immutable processing; log only opaque IDs and generic errors. Provider responses are not logged and generic messages avoid reflecting recipient/body data. Access is restricted to the creating authorized user. Cloudflare access administrators can still access D1; restrict account roles accordingly.

**Retention automation is pending.** Use only synthetic/test data now. Before customer use, configure an agreed retention period, implement cascading expiration and document backup/provider deletion windows. Preserve minimal non-PII idempotency tombstones so expired content cannot cause a retained Outlook draft to send again. Do not retain unresolved sends indefinitely without an explicit policy. SMTP2GO documents 5-day activity reporting on free and 30-day reporting on paid plans; verify account-specific settings and contractual retention/deletion separately. [Provider plan notes](https://developers.smtp2go.com/docs/rate-limiting).

## Rotation and recovery

Rotate the provider API key by issuing a new restricted key, updating the Worker secret through the interactive CLI, testing against a controlled inbox, then revoking the old key. Never change frozen mock rows to live. A missing/changed live configuration halts affected test messages for review.

Before schema changes, use the authorized D1 export/Time Travel backup process. Restoring an old database can resurrect work that has already been accepted by the provider: **pause consumers and repair triggers before restore**, preserve existing recipient/provider IDs, and reconcile every restored pending/attempting row before resuming. Backups contain PII and need restricted encrypted storage and expiry. A backup is not a safe replay mechanism. [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/).
