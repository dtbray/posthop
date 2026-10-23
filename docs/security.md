# Repository security operations

## Active protections

GitHub settings enable the dependency graph, Dependabot alerts, automatic security-fix PRs and private vulnerability reporting. CodeQL default setup analyzes JavaScript/TypeScript and Actions with extended queries, remote/local threat sources, PR/push scans and a weekly schedule. Default setup is configured in repository settings rather than a second competing CodeQL workflow.

`.github/dependabot.yml` schedules weekly npm/pnpm and Actions updates. Nonbreaking npm updates are grouped; major updates remain separate for review. Dependency review blocks newly introduced high/critical vulnerabilities on PRs. Existing vulnerabilities remain visible in Dependabot; release audits also check the whole installed dependency graph.

GitHub secret scanning and push protection are enabled. The API did **not** enable non-provider pattern scanning or provider validity checks on this personal public repository; both remained disabled after the request. No paid Secret Protection subscription was enabled. Gitleaks provides an independent secret check in `.github/workflows/gitleaks.yml`; it checks pushes, PRs, weekly and on demand. Git checkout includes complete history. The pinned Gitleaks action is usable for a personal account without an organization license. If ownership moves to an organization, review the action licensing or use the standalone open-source CLI.

External Actions are pinned to full commit hashes, workflow permissions default to read-only, and dependency installation runs behind the pinned **Socket Firewall Free** binary. Check and Release workflows explicitly execute `sfw pnpm install --frozen-lockfile`. This needs no Socket account/API secret. Socket checks package-install risk; it does not replace CodeQL, vulnerability review or secret detection. Failures block the job; there is no unprotected-install fallback.

## Socket GitHub App (optional additional reporting)

The free firewall integration is already part of CI. To add Socket's per-PR supply-chain analysis/dashboard, the repository owner can install [Socket Security](https://github.com/marketplace/socket-security) for **only `dtbray/posthop`** and select a free public-repository plan. The GitHub OAuth token available here cannot install a new third-party GitHub App on the owner's behalf. No Socket API key is needed for the firewall; do not create or paste one into source control.

[Socket Action documentation](https://github.com/SocketDev/action) describes the free firewall and optional App. [Socket CI documentation](https://docs.socket.dev/docs/socket-for-github-actions) covers a separate API-key-based integration; it is not used by this repository.

## Ignored files

`.gitignore` covers local `.dev.vars*`/`.env*` with explicit example-file exceptions, private keys and certificate containers, local credential exports/directories, D1/SQLite state and exports, backups, build/coverage/browser artifacts, scanner output and editor/OS state. `.certs` is private local material. Source migrations, the lockfile, manifest template, policies and example configuration remain tracked. Ignoring a file never removes a previously tracked copy; scan history and rotate exposed credentials.

For local checks with the standalone CLI:

```sh
gitleaks git --redact --log-opts="--all" .
gitleaks dir --redact .
```

The directory scan also traverses dependencies/generated files unless exclusions are configured; use a clean source checkout for the useful pre-push scan. Keep any redacted reports in ignored files. Test-only placeholder strings are not live credentials; prefer narrow per-finding allowlists if a future fixture causes a false positive. Do not disable a scanner or blanket-allow source directories to make a check pass.

## Maintainer response

Use the repository Security tab for Dependabot, CodeQL, secret findings and private reports. Triage failures before merging; bots do not automatically merge dependency updates. Prioritize credential rotation and customer-data exposure. Read `SECURITY.md` for disclosure policy and `docs/releasing.md` for release integrity. Cloudflare deployment and customer sending remain separately authorized actions.

## Dependency baseline

The first audit found vulnerabilities in the initial development-tool baseline. Vitest and Microsoft manifest tooling were upgraded. The direct Miniflare test dependency is pinned to `5.20261019.2-beta`, matching the version already selected by Wrangler 4.152.0 and its patched `undici`/`sharp` dependencies. Tests use Miniflare’s exported v4-options conversion helper. This is a tooling dependency, not a change to the deployed Worker API. Revisit the explicit beta pin when Cloudflare publishes a stable replacement.
