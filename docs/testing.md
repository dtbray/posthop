# Test procedures and evidence

## Automated local tests

`pnpm test` runs Vitest through the local Vite+ toolchain. Shared tests cover normalization, plus addresses, CSV BOM/CRLF/quoted fields, Square Customer Directory columns, blank rows, malformed CSV, invalid addresses and duplicate rows. Provider tests use fake HTTPS responses and cover individual envelope/payload, correlation, HTTP 429, 400, 500, suppression-style refusal, malformed response and transport timeout.

Integration tests bundle the real Worker with esbuild and run it inside Miniflare with actual emulated D1 and Queue bindings. They cover auth rejection, forged sender, one-recipient enforcement, concurrent duplicate submission, immutable-content conflict, creator isolation, mock processing without browser requests, repeated Queue triggers, scheduled outbox repair and stale-send quarantine. The recovery-only test route exists solely in the test harness, never in the app bundle.

`pnpm test:e2e` runs seven Playwright Chromium workflows: standalone CSV review/submission, the Office compose callback contract, reopening a submitted draft after pane closure, changed-content blocking, failed property writes, attachment rejection, and clear mock-delivery labeling while real authentication remains required. Office.js is stubbed in browser tests; these test our integration contract and do not replace a real Outlook test. The separate required `browser-tests` CI job runs the same command. It uses its own mock-only Worker configuration and local database under `apps/outlook-addin/tests/worker`, isolating browser tests from the live-integration `.dev.vars` file. Browser automation uses port 8788, leaving the manual integration backend on port 8787. Install the browser with `pnpm exec playwright install chromium` if needed.

Authentication tests verify real RSA-signed JWTs against a mocked Microsoft JWKS endpoint, including altered signature, wrong audience, expiry and authorization-claim rejection.

`pnpm check` is the static gate: Oxfmt formatting, Oxlint with type-aware promise rules, and TypeScript checking. `pnpm typecheck` remains available for a standalone TypeScript compiler diagnostic. `pnpm verify` runs audit, static checks, unit/integration tests, build, and browser workflows using the same commands as CI. `pnpm build` builds static assets and performs `wrangler deploy --dry-run` (no resource deployment). `pnpm manifest:validate` checks the XML manifest with Microsoft's validator; local HTTPS reachability requires your own trusted certificate/server.

## Manual local browser smoke test

Follow README, then open http://localhost:8787. Confirm local simulation notice. Prepare sample; import a CSV containing a valid row, duplicate and invalid address; correct invalid CSV; select the valid test address. Verify preview, sender, recipient and confirmation. Submit, record batch ID, refresh until provider-accepted with `mock-` provider ID. Reopen the same prepared sample and submit identical content/address; expect the same batch ID. Changed content/recipient with an already-used key must be blocked. No real recipient receives mail.

## Required Outlook on the web end-to-end test (not yet executed)

Prerequisites: authorized Microsoft 365 test mailbox, supported Outlook web/browser, trusted HTTPS host, approved sideload/admin permission, Entra registration/consent and configured allowed staff. Initially use the mock provider with real Entra authentication. For a real send, separately obtain authorization and configure a verified SMTP2GO sender, API key and one monitored test inbox. Never use customer addresses.

1. Sideload reviewed manifest. Compose a new draft with a distinctive subject, Unicode, paragraphs, a link and plain-text content. Do not attach files/images. Open Posthop.
2. Confirm sign-in uses the intended tenant/account. An unauthorized staff account, expired/wrong-audience token and unconfigured sender must be denied by the backend.
3. Prepare the draft explicitly. Confirm subject and formatted body match Outlook; preview must not load remote content. Change the draft after preparing: Send must require preparation/review again.
4. Select the single approved test recipient; verify the sender and Reply-To. Review, confirm and submit.
5. On durable confirmation, record the batch ID and close Outlook immediately. Verify processing continues through the status API/database/provider reports. Reopen the prepared draft: reuse its key; a repeat with identical payload returns the original batch and does not send again.
6. For the approved live test, verify exactly one individually addressed message in the test inbox, HTML/text alternatives, correct replies, SPF/DKIM/DMARC results and provider email ID. Check no Exchange Sent Items message was created. Draft remains present and unmodified except the disclosed add-in tracking key.
7. Capture actual webhook JSON fixtures with synthetic/test-only addresses for phase 3, including delivered/reject/bounce and header correlation. Do not enable customer webhook ingestion until authentication, schema/dedupe and event-order tests exist.

Record date, manifest version, tenant/browser/Outlook versions, provider mode, opaque batch/provider IDs and results in a private test record; never commit tokens or customer content. Mark the phase 1 integration gate complete only after these steps succeed. Closing a browser does not simulate an unknown-result provider timeout: that boundary is tested separately with the adapter and interrupted durable claims.

## Remaining acceptance coverage

Bulk partial failures, atomic daily/monthly quotas, complete recipient-list correction, webhook auth/dedupe/reordering, suppression-aware manual retries, automated retention and live Outlook/NAA behavior belong to upcoming phases and are not covered by current completion claims.

## Local validation record (2026-10-23)

32 Vitest tests passed, including frontend NAA scope/cache/interaction and unsupported-host and standalone-preview and blocked-Office-script checks. Seven Chromium workflows, static checks, static build/Worker dry run, and Microsoft XML manifest validation passed. Test data and mocked provider only. No live Outlook/Entra tenant integration or real SMTP2GO delivery was executed.
