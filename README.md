# Posthop

**Compose in Outlook. Send your way.**

Posthop is an open-source Outlook add-in for sending email through external providers without leaving your inbox.

Write your message in Outlook, pick your recipients, and let Posthop handle delivery. No BCC gymnastics, no mail-merge spreadsheets, no marketing platform required.

### Features

- **Bring your own provider.** SMTP2GO first, bring your own.
- **Send individually.** One message per recipient, not a giant BCC.
- **Track delivery.** See what landed, bounced, or failed.
- **Keep working.** Batches continue sending after you close Outlook.
- **Self-host it.** Built on CloudFlare Workers and D1.

### Status

🚧 Early development. Not ready for production use.

### License

Open source. AGPL3.

---

## Prototype setup

An independent Outlook on the web add-in for event instructions sent through SMTP2GO. No BiFrost dependency.

**Current milestone: local, single-recipient proof of concept.** Includes React/Fluent UI pane, supported Office.js draft reads, CSV inspection, Entra NAA integration, immutable D1 submissions, durable queue processing, mock provider, and a server-only SMTP2GO adapter. Live sending is restricted to configured test inboxes. Mock delivery remains the default. Test-tenant authentication and real SMTP2GO delivery have separate integration gates; production deployment and customer mail remain out of scope for this prototype.

## Run locally

Requires Node **22.18+ on the 22.x line** (or 24.11+/26+) and pnpm **10.34.7** (`corepack enable`, then `corepack prepare pnpm@10.34.7 --activate`, or install that pnpm version).

```sh
pnpm install --frozen-lockfile
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm db:local
pnpm dev
```

Open http://localhost:8787. Prepare the sample draft, enter a syntactically valid test address, review, and submit. Refresh status: the provider ID starts with `mock-`. No external email request occurs in mock mode. The local token is intentionally public and works only with local configuration, a loopback request hostname, and mock mode. Bind the dev server to loopback; never publish that configuration.

```sh
pnpm check          # Vite+ formatting, type-aware lint, and type checking
pnpm test           # unit and Worker integration tests
pnpm test:e2e       # Chromium browser workflows
pnpm verify         # complete local/CI gate set; no deployment
pnpm manifest:validate
```

For frontend hot reload: keep the Worker running and run `pnpm dev:web`; browse http://localhost:3000. Outlook requires **trusted HTTPS**; see [deployment](docs/deployment.md).

## What is ready, and what remains

- Single-recipient submissions survive pane closure, are idempotent, and freeze sender/content.
- Only definite rate-limit responses are automatically retried. Unknown outcomes stop for review.
- A successful provider response is **accepted**, never labeled delivered.
- CSV parser supports UTF-8 BOM, quoting, CRLF, common Square Customer Directory headers, invalid-row errors and duplicate warnings. Bulk submission is intentionally disabled.
- Tenant sign-in, Outlook sideloading, and real SMTP2GO delivery require credentials and controlled integration testing. These have **not** been validated against a business tenant.
- Webhook ingestion, delivery/bounce counters, quotas, safe manual retry, retention automation, cancellation, and bulk sending are planned, not implemented. This is not the accepted MVP or a production release.

Start with [feasibility](docs/feasibility.md), [architecture decision](docs/decisions/0001-independent-mailer.md), [setup/configuration](docs/configuration.md), [Outlook test procedure](docs/testing.md), and [phased plan](docs/plan.md).

Structure follows the specification: `apps/outlook-addin`, `apps/worker`, `packages/shared`, `packages/smtp2go`, `db/migrations`, `docs`. Dependencies are managed at the root to keep this small workspace simple.

Repository maintenance: [security protections](docs/security.md), [security disclosure](SECURITY.md), and [tag-based release flow](docs/releasing.md).

Vite+ is installed locally; no global CLI is required. `pnpm format` applies formatting, and `pnpm lint` runs lint checks alone. See [toolchain decision](docs/decisions/0002-vite-plus-and-test-gates.md).
