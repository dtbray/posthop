# Configuration and unresolved access

No service accounts or business credentials are present. Local simulation works without them.

| Setting | Meaning |
|---|---|
| APP_ENV | `production` by default; `local` only for loopback mock development |
| PROVIDER_MODE | `mock` or `smtp2go`; never change a persisted mock batch into live mail |
| TENANT_ID | Business Entra directory UUID |
| API_AUDIENCE | API app registration client UUID; access token `aud`, without `api://` |
| CLIENT_ID | Add-in SPA app registration client UUID; must match token `azp` |
| ALLOWED_OBJECT_IDS | Comma-separated authorized staff Entra object UUIDs |
| SENDER_EMAIL / SENDER_NAME | Configured provider-verified sending identity |
| REPLY_TO | Monitored business mailbox |
| TEST_RECIPIENTS | Comma-separated controlled inboxes; mandatory for live prototype sends |
| MAX_ATTEMPTS | Maximum safe rate-limit attempts, default 3 |
| SMTP2GO_API_KEY | Worker secret only; needed for live controlled tests |
| DEV_AUTH_TOKEN | Local mock token; `.dev.vars.example` matches the browser demo |

## Entra boundary (requires tenant administrator)

Create single-tenant API and SPA registrations. Expose an API delegated scope `api://<API_CLIENT_UUID>/Mail.Send.External` and configure API access tokens to version 2. Give the SPA delegated permission to that scope and grant required consent. Configure an SPA broker redirect `brk-multihub://<addin-origin-host[:port]>` per Microsoft's NAA instructions. Use the actual HTTPS add-in origin, not a page path. Set `CLIENT_ID`, `API_AUDIENCE`, `TENANT_ID`, and authorized object IDs on the Worker. The browser asks for this API scope; it does not request Graph Mail.Send.

NAA support is checked at runtime. Additional host/browser restrictions and broker registration need testing in the intended tenant. No fallback to insecure mailbox identifiers is implemented. Do not put a client secret in the pane: this is a public client. [Microsoft NAA setup](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/enable-nested-app-authentication-in-your-add-in).

## SMTP2GO boundary (requires provider administrator)

Verify the business-controlled sending domain/address and select a recognizable sender plus monitored Reply-To. Create a restricted API key. Enable open/click tracking in the provider only after the business has chosen an appropriate privacy policy. The app does not override that provider setting. Use provider dashboard reports as primary analytics.

Follow SMTP2GO's exact domain verification instructions. Prefer a sending subdomain if appropriate. Do not replace the existing Microsoft 365 SPF record or weaken DMARC; use provider-issued records and verify actual DKIM/DMARC alignment and reply routing in a controlled test. [Sender domains](https://support.smtp2go.com/hc/en-gb/articles/223087647-Sender-Domains).

The live prototype path requires real Entra authentication, an API key secret and an explicit test recipient allowlist. Mock auth cannot be used to send live email. The provider adapter is already exercised with fake HTTPS responses in tests. No supported SMTP2GO sandbox is assumed to deliver a test message; a sandboxed key may reject mail. Real controlled delivery requires separate authorization and a monitored test inbox.

## Secrets

Copy `.dev.vars.example` only for local mock work. For an authorized cloud test deployment, set `SMTP2GO_API_KEY` through `pnpm --dir apps/worker exec wrangler secret put SMTP2GO_API_KEY` using its interactive prompt. Never store keys in configuration, manifests, browser storage or source control. Do not copy development auth settings to a deployment.
