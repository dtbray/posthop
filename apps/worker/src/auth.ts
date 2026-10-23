import { createRemoteJWKSet, jwtVerify } from "jose";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticate(
  request: Request,
  env: Pick<
    Env,
    | "APP_ENV"
    | "PROVIDER_MODE"
    | "DEV_AUTH_TOKEN"
    | "TENANT_ID"
    | "API_AUDIENCE"
    | "CLIENT_ID"
    | "ALLOWED_OBJECT_IDS"
  >,
): Promise<string> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Sign in required");
  const hostname = new URL(request.url).hostname;
  if (
    env.APP_ENV === "local" &&
    ["localhost", "127.0.0.1"].includes(hostname) &&
    env.PROVIDER_MODE === "mock" &&
    env.DEV_AUTH_TOKEN &&
    token === env.DEV_AUTH_TOKEN
  )
    return "local-test-user";
  if (
    !/^[0-9a-f-]{36}$/i.test(env.TENANT_ID) ||
    !env.API_AUDIENCE ||
    !env.CLIENT_ID
  )
    throw new HttpError(503, "Entra authentication is not configured");
  try {
    const issuer = `https://login.microsoftonline.com/${env.TENANT_ID}/v2.0`;
    const jwks = createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${env.TENANT_ID}/discovery/v2.0/keys`,
      ),
    );
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.API_AUDIENCE,
      algorithms: ["RS256"],
      requiredClaims: ["exp"],
    });
    if (
      payload.tid !== env.TENANT_ID ||
      typeof payload.oid !== "string" ||
      payload.azp !== env.CLIENT_ID ||
      typeof payload.scp !== "string" ||
      !payload.scp.split(" ").includes("Mail.Send.External")
    )
      throw new HttpError(403, "Required delegated scope or client missing");
    if (
      !env.ALLOWED_OBJECT_IDS.split(",")
        .map((s) => s.trim())
        .includes(payload.oid)
    )
      throw new HttpError(403, "User is not authorized to send");
    return `${env.TENANT_ID}:${payload.oid}`;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Invalid or expired access token");
  }
}
