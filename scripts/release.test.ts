import { describe, it, expect } from "vite-plus/test";
import {
  releaseVersion,
  manifestVersion,
  assertVersions,
  verifyChecksums,
  sha256,
} from "./release-lib.mjs";
describe("release identity and integrity gates", () => {
  it("requires a stable semver tag and consistent package/manifest identity", () => {
    expect(releaseVersion("v0.1.0")).toBe("0.1.0");
    expect(manifestVersion("v0.1.0")).toBe("1.1.0.0");
    expect(() => manifestVersion("v65535.0.0")).toThrow();
    for (const tag of ["main", "v01.2.3", "v1.2.3-rc.1", "v1.2.3;echo bad"])
      expect(() => releaseVersion(tag)).toThrow();
    expect(() =>
      assertVersions("v1.2.3", { root: { version: "1.2.2" } }, "<Version>1.2.3.0</Version>"),
    ).toThrow();
    expect(() =>
      assertVersions("v1.2.3", { root: { version: "1.2.3" } }, "<Version>1.2.2.0</Version>"),
    ).toThrow();
  });
  it("rejects changed, missing, extra, duplicate or path-traversal release assets", () => {
    const hash = sha256(Buffer.from("data"));
    expect(() =>
      verifyChecksums(`${hash}  file.tgz`, { "file.tgz": Buffer.from("data") }),
    ).not.toThrow();
    expect(() =>
      verifyChecksums(`${hash}  file.tgz`, {
        "file.tgz": Buffer.from("changed"),
      }),
    ).toThrow();
    expect(() => verifyChecksums(`${hash}  file.tgz`, {})).toThrow();
    expect(() =>
      verifyChecksums(`${hash}  file.tgz`, {
        "file.tgz": Buffer.from("data"),
        extra: Buffer.from("data"),
      }),
    ).toThrow();
    expect(() =>
      verifyChecksums(`${hash}  file.tgz\n${hash}  file.tgz`, {
        "file.tgz": Buffer.from("data"),
      }),
    ).toThrow();
    expect(() => verifyChecksums(`${hash}  ../file.tgz`, {})).toThrow();
  });
});
