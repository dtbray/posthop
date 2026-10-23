# Release flow

This follows the useful parts of [HaloCLI's release workflow](https://github.com/Midtown-Technology-Group/halocli/blob/dbe466b5ed2e7efbbd15ca09bcab0e9a3c57cdf4/.github/workflows/release.yml) and [release driver](https://github.com/Midtown-Technology-Group/halocli/blob/dbe466b5ed2e7efbbd15ca09bcab0e9a3c57cdf4/scripts/release.py), reviewed at commit `dbe466b5ed2e7efbbd15ca09bcab0e9a3c57cdf4`.

Shared pattern: explicit version; clean-main preflight; test/build/audit gates; exact-tag checkout; generated GitHub notes; SBOM/checksummed assets; read-only verification after an interrupted release; never move an existing release tag. Posthop packages a web/Worker application, so HaloCLI's Python wheels, Windows MSI, Winget-feed publishing and pipx installation do not apply. No Halo-specific application code or infrastructure is imported.

## Before a release

Releases are deliberate maintainer actions. Adding this flow does not authorize creating a release tag, publishing a release, installing tenant add-ins, changing DNS or deploying Cloudflare.

1. Choose a stable `X.Y.Z` version. Update the root and all four workspace `package.json` versions together, plus `<Version>(X+1).Y.Z.0</Version>` in the Outlook XML manifest. Outlook rejects manifest versions below 1.0, so the manifest major is always the app major plus one (`0.1.0` → `1.1.0.0`); the release identity gate enforces that mapping. Run `pnpm install --lockfile-only` if package metadata changes affect the lockfile. The current prototype is `0.1.0`; that number alone does not imply a production release.
2. Commit the version bump through normal review and merge it to `main`. Require the Check workflow to pass on the exact main SHA. Keep the working tree clean and synchronized with `origin/main`.
3. Run `pnpm release X.Y.Z --dry-run`. This validates versions and reports dirty-tree/branch/tag problems without creating or pushing tags. The plain command also defaults to dry-run.
4. When explicitly authorized, run `pnpm release X.Y.Z --yes`. It runs the shared `pnpm verify` gate (format, lint, type checks, unit tests, browser tests, build and dependency audit); verifies exact-main CI; creates an annotated `vX.Y.Z` tag or verifies the existing tag; pushes it once; watches the Release workflow; downloads/verifies the resulting assets. It never moves a mismatched tag or silently redispatches an uncertain workflow.

## GitHub Release workflow

A pushed `vX.Y.Z` tag triggers `.github/workflows/release.yml`. Manual dispatch accepts **only an existing tag**, then checks out `refs/tags/<tag>` rather than the selected branch. The workflow repeats identity/test/audit/build gates and installs dependencies through Socket Firewall Free. No Cloudflare credential is available or needed.

Packaging runs through `pnpm release:package <tag>` and uses the pnpm-provided CLI entrypoint plus fixed `/usr/bin/git` and `/usr/bin/tar` paths on the Linux release runner. The packaging script verifies that HEAD is the exact tag commit and the checkout is clean. It creates:

- `posthop-X.Y.Z.tar.gz`: built static pane, Worker dry-run output, manifest template, migration/configuration/setup references, lockfile and license notices.
- `posthop-sbom.cdx.json`: CycloneDX 1.6 inventory of installed runtime and build dependencies from pnpm's license inventory; not an assertion of bundle reachability or a fully resolved dependency-edge graph. No local installation paths are included.
- `release.json`: version, tag and exact source commit.
- `SHA256SUMS`: hashes of all three assets.

The workflow creates a **draft** GitHub Release with generated notes. Review the prototype/production status, notes, SBOM and artifact identity, then publish the draft when authorized. Creating a release or tag does not deploy anything. The manifest remains an operator-configured template, and the artifact is not a one-click configured tenant installation.

## Verification and recovery

`pnpm release X.Y.Z --verify-existing` downloads the assets from that release, rejects missing/unexpected/changed/duplicate checksum entries and checks metadata against the remote tag's peeled commit. It works for a draft visible to the maintainer. Checksums detect corruption, not a compromised publisher; they are not a cryptographic publisher signature.

Rerunning `--yes` can reuse a tag only when its commit matches HEAD and versions match. It resumes watching an existing run. A failed or ambiguous run stops for inspection; it never automatically retries a publish. GitHub release creation refuses an existing release rather than replacing assets. If a draft is incomplete, inspect the run and existing asset identities before deciding how to repair it. Never retag a published version to make a build pass; use a new version for changed source.

No release or production deployment was performed while setting up this flow. The automated unit tests cover tag/version mismatches and asset-integrity checks; the package/archive path is rehearsed locally against an unpublished temporary tag. The first real GitHub release still needs an authorized tag-triggered end-to-end run.
