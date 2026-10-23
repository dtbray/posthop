import { createHash } from "node:crypto";
export function releaseVersion(tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
    throw new Error("Release tag must be vX.Y.Z (no prerelease suffix).");
  return tag.slice(1);
}
export function manifestVersion(tag) {
  const parts = releaseVersion(tag).split(".").map(Number);
  if (parts[0] > 65534 || parts[1] > 65535 || parts[2] > 65535)
    throw new Error("Version exceeds Outlook manifest limits");
  return `${parts[0] + 1}.${parts[1]}.${parts[2]}.0`;
}
export function assertVersions(tag, packages, manifest) {
  const version = releaseVersion(tag);
  for (const [name, pkg] of Object.entries(packages))
    if (pkg.version !== version)
      throw new Error(`${name} version ${pkg.version} does not match ${tag}`);
  if (!manifest.includes(`<Version>${manifestVersion(tag)}</Version>`))
    throw new Error("Outlook manifest version does not match the release");
  return version;
}
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export function verifyChecksums(checksums, files) {
  const seen = new Set();
  for (const line of checksums.trim().split("\n")) {
    const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/);
    if (!match || seen.has(match[2]))
      throw new Error("Invalid or duplicate checksum entry");
    const [, digest, name] = match;
    seen.add(name);
    if (!Object.hasOwn(files, name) || sha256(files[name]) !== digest)
      throw new Error(`Checksum mismatch: ${name}`);
  }
  if (Object.keys(files).length !== seen.size)
    throw new Error("Unexpected or unchecked release asset");
}
