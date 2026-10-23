export function manifestVersion(tag: string): string;
export function releaseVersion(tag: string): string;
export function assertVersions(
  tag: string,
  packages: Record<string, { version: string }>,
  manifest: string,
): string;
export function sha256(data: string | Uint8Array): string;
export function verifyChecksums(checksums: string, files: Record<string, Uint8Array>): void;
