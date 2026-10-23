import {
  mkdtemp,
  mkdir,
  cp,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { checkRelease } from "./release-check.mjs";
import { sha256 } from "./release-lib.mjs";
const tag = process.argv[2];
if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
  throw new Error("Expected vX.Y.Z tag");
const version = await checkRelease(tag);
// pnpm supplies its own CLI entrypoint; invoke it via the running Node binary,
// rather than resolving a command from the current directory or PATH.
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli || !isAbsolute(pnpmCli) || basename(pnpmCli) !== "pnpm.cjs")
  throw new Error("Run packaging through pnpm release:package");
if (
  execFileSync("/usr/bin/git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim()
)
  throw new Error("Release packaging requires a clean committed checkout");
const commit = execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const tagged = execFileSync(
  "/usr/bin/git",
  ["rev-parse", "--verify", "--end-of-options", `${tag}^{commit}`],
  {
    encoding: "utf8",
  },
).trim();
if (commit !== tagged)
  throw new Error("Release build must use the exact tagged checkout");
const out = "artifacts";
await mkdir(out, { recursive: true });
if ((await readdir(out)).length)
  throw new Error(
    "artifacts directory must be empty; never overwrite release output",
  );
const staging = await mkdtemp(join(tmpdir(), "posthop-release-"));
try {
  const bundle = join(staging, "posthop");
  await mkdir(bundle);
  for (const path of [
    "apps/outlook-addin/dist",
    "apps/outlook-addin/manifest/manifest.xml",
    "apps/worker/dist",
    "apps/worker/wrangler.jsonc",
    "db/migrations",
    "docs",
    "README.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "pnpm-lock.yaml",
    "package.json",
  ]) {
    const target = join(bundle, path);
    await mkdir(join(target, ".."), { recursive: true });
    await cp(path, target, { recursive: true });
  }
  const metadata = {
    name: "posthop",
    version,
    tag,
    commit,
    packaging:
      "Cloudflare Worker dry-run output + static assets + manifest template; operator configuration required",
    deployed: false,
  };
  await writeFile(
    join(bundle, "release.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  execFileSync("/usr/bin/tar", [
    "-czf",
    join(process.cwd(), out, `posthop-${version}.tar.gz`),
    "-C",
    staging,
    "posthop",
  ]);
  const inventory = JSON.parse(
    execFileSync(
      process.execPath,
      ["--", pnpmCli, "licenses", "list", "--json"],
      {
        encoding: "utf8",
        maxBuffer: 20_000_000,
      },
    ),
  );
  const components = new Map();
  for (const packages of Object.values(inventory))
    for (const pkg of packages)
      for (const v of pkg.versions) {
        const purl = `pkg:npm/${pkg.name.replaceAll("@", "%40")}@${v}`;
        components.set(purl, {
          type: "library",
          "bom-ref": purl,
          name: pkg.name,
          version: v,
          purl,
        });
      }
  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: { type: "application", name: "posthop", version },
    },
    components: [...components.values()].sort((a, b) =>
      a.purl.localeCompare(b.purl),
    ),
  };
  await writeFile(
    join(out, "posthop-sbom.cdx.json"),
    JSON.stringify(bom, null, 2) + "\n",
  );
  await writeFile(
    join(out, "release.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  const names = (await readdir(out)).sort();
  const lines = [];
  for (const name of names)
    lines.push(`${sha256(await readFile(join(out, name)))}  ${name}`);
  await writeFile(join(out, "SHA256SUMS"), lines.join("\n") + "\n");
  console.log(
    `Packaged ${tag} at ${commit}. SBOM inventories installed runtime/build dependencies; it is not a complete runtime bundle reachability graph.`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
