# Deployment and Outlook setup

These are operator instructions for a later **explicitly authorized** deployment. The prototype has only been built and tested locally. No deployment automation runs on push.

## Local browser test

Follow README. `pnpm db:local` applies migrations to local emulation only. `pnpm dev` builds the pane and starts local Workers/D1/Queues. Local HTTP is for the standalone simulation, not Outlook sideloading. Development resources persist under `apps/worker/.wrangler`; keep customer data out of local tests.

## Outlook HTTPS development

Obtain a locally trusted certificate for `localhost` with your organization's approved tool (for example Microsoft's `office-addin-dev-certs`), including private key and certificate PEM files. Place them at `.certs/localhost.key` and `.certs/localhost.crt` in the repository root (both ignored). Never commit the private key. Start Worker on loopback port 8787, then start the Vite frontend with:

```sh
pnpm dev:web
```

Vite serves HTTPS on localhost:3000 when both project-local certificate files exist and proxies `/api` to the local Worker. Confirm the browser trusts https://localhost:3000 without bypassing certificate errors. The server uses a strict port to avoid silently serving a different origin. If that port is occupied, choose a free port explicitly (for example `pnpm dev:web --port 3001`), register that exact broker origin, and generate a matching manifest with `node scripts/manifest.mjs https://localhost:3001`. The checked-in manifest points there. For a real Entra test, configure the registrations first and use mock provider mode with actual Entra auth (`APP_ENV=production` locally); do not use mock identity to validate SSO.

Sideload the add-in-only XML through https://aka.ms/olksideload → My add-ins → Add a custom add-in → Add from file. Select `apps/outlook-addin/manifest/manifest.xml`. Tenant policy may require the administrator to allow custom add-ins. Compose a new message, open Apps/add-ins from the compose ribbon, select Posthop. Ribbon locations can vary by Outlook version. [Official sideloading guide](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing).

## Authorized HTTPS test deployment

1. Review the production gaps in `docs/plan.md`; this release is controlled-test only.
2. Log into the intended Cloudflare account. Confirm the selected plan/costs; do not auto-upgrade. Create D1 `posthop` and Queue `posthop-deliveries`. Replace the all-zero database UUID in `apps/worker/wrangler.jsonc` with the real ID.
3. Configure Entra values, authorized staff, verified sender, reply mailbox and controlled test recipients. Retain `APP_ENV=production`; initially keep `PROVIDER_MODE=mock`. Set provider secrets interactively only when approved to test live mail.
4. Apply remote D1 migrations deliberately, then build and deploy:

```sh
pnpm --dir apps/worker exec wrangler d1 migrations apply posthop --remote
pnpm build
pnpm --dir apps/worker exec wrangler deploy
```

5. Generate a manifest for the exact HTTPS origin with `node scripts/manifest.mjs https://your-worker.example`. Output is `apps/outlook-addin/manifest/manifest.generated.xml`. Review it and run the manifest validator against it. The task pane, icons, support and AppDomain URLs must all be reachable. This script does not deploy or install anything.
6. Configure the matching NAA SPA broker redirect, then sideload in an authorized test mailbox. For business deployment use Microsoft 365 admin center → Settings → Integrated apps → Upload custom apps, assign only approved staff and follow the tenant's admin-consent process. [Central deployment](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/centralized-deployment-of-add-ins).
7. Complete `docs/testing.md` before calling the deployment usable. The application is self-contained on Cloudflare with no BiFrost runtime dependency.

## Cloudflare considerations

D1 migrations are separate from Worker deploy; Queues must exist before deployment. The queue producer and consumer use the same Worker. The cron repair path is essential to recover the DB/enqueue gap and expired queue triggers. Local Wrangler does not automatically exercise cron on a wall-clock schedule; use the current Wrangler scheduled-event endpoint `/cdn-cgi/local/scheduled` for local repair tests (older Wrangler versions use `--test-scheduled` and `/__scheduled`), or the automated Miniflare recovery tests. Current config limits consumer concurrency to 1. Configure account budget/usage notifications before live operation.
