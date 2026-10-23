import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { authenticate } from "../src/auth";
const tenant = "b264744e-e206-4b98-b3ce-94e4942ab7d4";
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
const config = {
  APP_ENV: "production",
  PROVIDER_MODE: "mock",
  TENANT_ID: tenant,
  API_AUDIENCE: "backend-api",
  CLIENT_ID: "frontend-spa",
  ALLOWED_OBJECT_IDS: "staff-id",
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
});
afterEach(() => vi.unstubAllGlobals());
async function token(overrides: Record<string, unknown> = {}) {
  const jwk = await exportJWK(keys.publicKey);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          keys: [{ ...jwk, kid: "key-1", alg: "RS256", use: "sig" }],
        }),
      ),
  );
  return new SignJWT({
    tid: tenant,
    oid: "staff-id",
    azp: "frontend-spa",
    scp: "Mail.Send.External",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "key-1" })
    .setIssuer(issuer)
    .setAudience("backend-api")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
}
const request = (bearer: string) =>
  new Request("https://mailer.example/api/batches", {
    headers: { Authorization: `Bearer ${bearer}` },
  });
describe("real JWT verification", () => {
  it("accepts a signed authorized tenant API token", async () => {
    expect(await authenticate(request(await token()), config)).toBe(
      `${tenant}:staff-id`,
    );
  });
  it.each([
    { oid: "someone-else" },
    { scp: "User.Read" },
    { azp: "other-client" },
    { tid: "other-tenant" },
  ])("rejects forbidden claims %j", async (claims) => {
    await expect(
      authenticate(request(await token(claims)), config),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a token with a changed payload/signature", async () => {
    const t = await token();
    const [head, payload, signature] = t.split(".");
    const changed = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString()),
        oid: "other",
      }),
    ).toString("base64url");
    await expect(
      authenticate(request(`${head}.${changed}.${signature}`), config),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects wrong-audience and expired tokens", async () => {
    await token();
    const signed = await new SignJWT({
      tid: tenant,
      oid: "staff-id",
      azp: "frontend-spa",
      scp: "Mail.Send.External",
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer(issuer)
      .setAudience("graph")
      .setExpirationTime("5m")
      .sign(keys.privateKey);
    await expect(authenticate(request(signed), config)).rejects.toMatchObject({
      status: 401,
    });
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer(issuer)
      .setAudience("backend-api")
      .setExpirationTime(0)
      .sign(keys.privateKey);
    await expect(authenticate(request(expired), config)).rejects.toMatchObject({
      status: 401,
    });
  });
});
