# ADR 0002: Local Vite+ toolchain and browser gates

Status: accepted for prototype, 2026-10-23.

## Decision

Adopt local Vite+ 1.4.0 for frontend development/build, formatting, type-aware linting and the existing Vitest 5 runner. Use its official migration-generated Vite alias/catalog and shared root configuration. Keep pnpm 10.34.7 and the existing workspace layout. No global Vite+ installation or automatic Git hooks are required.

The current Vite+ runtime supports Node 22.18+, 24.11+ and 26+. The private application engine declaration follows those supported lines; CI continues using current Node 22. Generated Worker declarations and the lockfile are excluded from formatting/lint rewrites, while TypeScript still sees the generated binding types.

`pnpm check` runs Oxfmt plus Oxlint type-aware/type checks and fails on warnings. Promise misuse, floating promises, awaiting non-promises and explicit `any` are errors. Fix findings instead of suppressing them. `pnpm verify:static` runs audit/check/tests/build; `pnpm verify` adds Playwright. CI and release workflows invoke these same commands.

## Cloudflare boundary

Vite+ builds the static Outlook pane; Wrangler still builds and runs the Worker, D1 and Queues. The Cloudflare Vite plugin is an option for consolidating full-stack development, but this application already has a small working static-assets/Worker boundary. Switching the backend build system is not necessary for the requested toolchain or Outlook integration. Vite+ frontend output and Wrangler deployment dry runs both pass locally.

## Browser and authentication coverage

A separate required `browser-tests` job installs Chromium and runs the existing CSV workflow plus Office compose callback/property/error/reopen scenarios. A provider-mock notice is independent of the local authentication bypass, so a credentialed tenant test cannot be mistaken for live delivery. The development server uses a strict port and denies private configuration/certificate paths.

Browser tests use synthetic messages and mock delivery, with explicit Office stubs. NAA unit tests verify API scope, in-memory cache, interactive fallback, failure propagation and unsupported hosts. They do not establish that the real tenant, broker, manifest or consent setup works; that remains a distinct live integration gate.

PR #1's late Kilo review completed successfully, and its scan findings were resolved before this milestone. Socket's GitHub App is now installed by the owner; the credential-free install firewall stays enabled alongside it.

## References

- [Vite+ migration rules](https://www.viteplus.dev/guide/migrate-rules)
- [Vite+ check and type-aware options](https://www.viteplus.dev/guide/check)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
