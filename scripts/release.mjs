#!/usr/bin/env node
// Adapted flow: Midtown-Technology-Group/halocli scripts/release.py (see docs/releasing.md).
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkRelease } from "./release-check.mjs";
import { releaseVersion, verifyChecksums } from "./release-lib.mjs";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const repo = "dtbray/posthop";
const args = process.argv.slice(2),
  value = args[0];
const allowed = new Set(["--yes", "--dry-run", "--verify-existing"]);
if (
  !value ||
  args.slice(1).some((a) => !allowed.has(a)) ||
  args.slice(1).filter((a) => allowed.has(a)).length > 1
)
  throw new Error(
    "Usage: pnpm release X.Y.Z [--dry-run | --yes | --verify-existing]",
  );
const tag = value.startsWith("v") ? value : `v${value}`,
  version = releaseVersion(tag);
const log = (message) =>
  console.log(`[${new Date().toISOString()}] ${message}`);
function run(command, parameters, options = {}) {
  return execFileSync(command, parameters, {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 20_000_000,
    ...options,
  })?.trim();
}
const git = (...parameters) => run("git", parameters);
const gh = (...parameters) => run("gh", [...parameters, "--repo", repo]);
const remote = git("remote", "get-url", "origin");
if (
  !/^(?:git@github\.com:|https:\/\/github\.com\/)dtbray\/posthop(?:\.git)?$/.test(
    remote,
  )
)
  throw new Error("origin must be dtbray/posthop on GitHub");
function remoteTag() {
  const lines = git(
    "ls-remote",
    "--tags",
    "origin",
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
  return lines.find(([, ref]) => ref.endsWith("^{}"))?.[0] ?? lines[0]?.[0];
}
async function verifyExisting() {
  const sha = remoteTag();
  if (!sha) throw new Error("Requested release tag does not exist on origin");
  const release = JSON.parse(
    gh("release", "view", tag, "--json", "tagName,isDraft"),
  );
  if (release.tagName !== tag) throw new Error("Release tag mismatch");
  const dir = await mkdtemp(join(tmpdir(), "posthop-verify-"));
  try {
    gh("release", "download", tag, "--dir", dir);
    const files = {};
    for (const name of await readdir(dir))
      if (name !== "SHA256SUMS") files[name] = await readFile(join(dir, name));
    verifyChecksums(await readFile(join(dir, "SHA256SUMS"), "utf8"), files);
    const expected = [
      `posthop-${version}.tar.gz`,
      "posthop-sbom.cdx.json",
      "release.json",
    ].sort();
    if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify(expected))
      throw new Error("Unexpected release assets");
    const metadata = JSON.parse(files["release.json"]);
    if (
      metadata.version !== version ||
      metadata.tag !== tag ||
      metadata.commit !== sha ||
      metadata.name !== "posthop"
    )
      throw new Error("Release metadata does not match tag/version/commit");
    log(
      `Verified checksums and tag identity for ${tag}${release.isDraft ? " (draft)" : ""}. Checksums detect corruption; they are not a publisher signature.`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
if (args.includes("--verify-existing")) {
  await verifyExisting();
  process.exit(0);
}
await checkRelease(tag);
const head = git("rev-parse", "HEAD"),
  problems = [];
if (git("status", "--porcelain"))
  problems.push(
    "Working tree is not clean; commit the version bump and all release files first.",
  );
if (git("branch", "--show-current") !== "main")
  problems.push("Releases must be made from main.");
const remoteHead = git("ls-remote", "origin", "refs/heads/main").split(
  /\s+/,
)[0];
if (remoteHead !== head) problems.push("HEAD must equal origin/main.");
const refs = git("for-each-ref", "--format=%(refname)", "refs/tags");
if (
  refs.split("\n").some((line) => line === `refs/tags/${tag}`) &&
  git("rev-parse", `${tag}^{commit}`) !== head
)
  problems.push("Existing local tag points to another commit.");
const remoteSha = remoteTag();
if (remoteSha && remoteSha !== head)
  problems.push(
    "Published tag points to another commit; it will never be moved.",
  );
for (const problem of problems) log(`PREFLIGHT: ${problem}`);
log(
  `Plan: verify clean main/version ${version}; run typecheck/tests/build/audit; create or verify ${tag}; push exact tag; watch Release; verify checksums. No deployment.`,
);
if (!args.includes("--yes")) {
  log("Dry run: no tag, workflow dispatch or GitHub Release mutation.");
  process.exit(0);
}
if (problems.length) throw new Error("Release preflight failed");
for (const task of ["typecheck", "test", "build"]) {
  log(`Running ${task}`);
  run("pnpm", [task], { stdio: "inherit", timeout: 600_000 });
}
run("pnpm", ["audit", "--audit-level", "high"], {
  stdio: "inherit",
  timeout: 120_000,
});
const runs = JSON.parse(
  gh(
    "run",
    "list",
    "--workflow",
    "check.yml",
    "--branch",
    "main",
    "--commit",
    head,
    "--limit",
    "1",
    "--json",
    "status,conclusion",
  ),
);
if (runs[0]?.status !== "completed" || runs[0]?.conclusion !== "success")
  throw new Error(
    "The Check workflow must be successful for the exact main commit",
  );
if (!refs.split("\n").some((line) => line === `refs/tags/${tag}`))
  git("tag", "-a", tag, "-m", `Posthop ${version}`);
if (!remoteSha) git("push", "origin", `refs/tags/${tag}`);
else
  log("Remote tag already matches; resuming without re-tagging or redispatch.");
const deadline = Date.now() + 30 * 60_000;
let complete = false;
while (Date.now() < deadline) {
  const workflows = JSON.parse(
    gh(
      "run",
      "list",
      "--workflow",
      "release.yml",
      "--branch",
      tag,
      "--commit",
      head,
      "--limit",
      "1",
      "--json",
      "databaseId,status,conclusion",
    ),
  );
  const workflow = workflows[0];
  if (workflow?.status === "completed") {
    if (workflow.conclusion !== "success")
      throw new Error(
        `Release run ${workflow.databaseId} concluded ${workflow.conclusion}; inspect before retrying. No automatic redispatch.`,
      );
    complete = true;
    break;
  }
  log(
    workflow
      ? `Release run ${workflow.databaseId}: ${workflow.status}`
      : "Waiting for tag-triggered Release workflow",
  );
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
if (!complete)
  throw new Error(
    "Timed out waiting for Release; inspect GitHub before rerunning",
  );
await verifyExisting();
log(
  `Release ${tag} verified. Publish its draft manually after reviewing the artifacts; deployment remains separate.`,
);
