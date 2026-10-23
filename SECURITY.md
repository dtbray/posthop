# Security policy

Posthop is a prototype. It is not ready for customer email or production use. Security fixes currently target the latest commit on `main`; there are no supported production release lines yet.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/dtbray/posthop/security/advisories/new). Include the affected commit/version, reproduction steps using synthetic data, expected and actual behavior, and likely impact. Do not include live credentials, customer addresses, email bodies or tenant access tokens.

Please avoid public issues for undisclosed vulnerabilities. Do not test against another person's Microsoft 365 tenant, SMTP2GO account, Cloudflare resources or recipients without their explicit permission. Use mocks or accounts/inboxes you control. We cannot promise a response deadline or bounty.

Relevant issues include authentication and authorization bypasses, sender spoofing, customer-data exposure, leaked credentials, duplicate-delivery risks and unsafe release/dependency behavior.

## Project protections

- GitHub dependency graph, Dependabot alerts/security fixes and scheduled npm/Actions updates.
- GitHub CodeQL for TypeScript/JavaScript and Actions, using extended queries.
- GitHub secret scanning/push protection plus an independent Gitleaks history scan.
- Dependency review blocks newly introduced high/critical vulnerabilities in pull requests.
- Socket Firewall Free checks package installations in CI and release builds. The optional Socket GitHub App adds dependency-change reporting; see [security operations](docs/security.md).
- Release builds use an exact version tag, test/audit gates and checksummed artifacts. No workflow deploys Cloudflare or sends email.

Never treat `.gitignore` or a successful scan as proof that a file contains no secret. If a real credential is exposed, revoke/rotate it first; removing the current file does not remove it from Git history, caches or forks.
