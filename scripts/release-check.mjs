import { readFile } from "node:fs/promises";
import { assertVersions } from "./release-lib.mjs";
export const packagePaths = [
  "package.json",
  "apps/outlook-addin/package.json",
  "apps/worker/package.json",
  "packages/shared/package.json",
  "packages/smtp2go/package.json",
];
export async function checkRelease(tag) {
  const packages = {};
  for (const path of packagePaths)
    packages[path] = JSON.parse(await readFile(path, "utf8"));
  return assertVersions(
    tag,
    packages,
    await readFile("apps/outlook-addin/manifest/manifest.xml", "utf8"),
  );
}
if (process.argv[1]?.endsWith("/release-check.mjs")) {
  await checkRelease(process.argv[2]);
  console.log(`Release identity verified: ${process.argv[2]}`);
}
