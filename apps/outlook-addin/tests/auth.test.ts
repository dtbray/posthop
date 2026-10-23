import { beforeEach, afterEach, describe, it, expect, vi } from "vite-plus/test";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
const mocks = vi.hoisted(() => ({ create: vi.fn(), silent: vi.fn(), popup: vi.fn() }));
vi.mock("@azure/msal-browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@azure/msal-browser")>()),
  createNestablePublicClientApplication: mocks.create,
}));
const config = {
  localMock: false,
  clientId: "frontend-client",
  tenantId: "test-tenant",
  scope: "api://backend/Mail.Send.External",
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("Office", {
    onReady: () => Promise.resolve(),
    context: { requirements: { isSetSupported: () => true } },
  });
  mocks.create.mockResolvedValue({
    acquireTokenSilent: mocks.silent,
    acquireTokenPopup: mocks.popup,
    getActiveAccount: () => null,
    getAllAccounts: () => [],
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("NAA frontend authentication boundary", () => {
  it("uses the API delegated scope and in-memory cache", async () => {
    mocks.silent.mockResolvedValue({ accessToken: "controlled-test-token" });
    const { accessToken } = await import("../src/auth");
    expect(await accessToken(config)).toBe("controlled-test-token");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: { cacheLocation: "memoryStorage" },
        auth: {
          clientId: config.clientId,
          authority: `https://login.microsoftonline.com/${config.tenantId}`,
        },
      }),
    );
    expect(mocks.silent).toHaveBeenCalledWith(expect.objectContaining({ scopes: [config.scope] }));
    expect(mocks.popup).not.toHaveBeenCalled();
  });
  it("requests interaction only for an interaction-required failure", async () => {
    mocks.silent.mockRejectedValue(
      new InteractionRequiredAuthError("interaction_required", "Sign-in required"),
    );
    mocks.popup.mockResolvedValue({ accessToken: "interactive-test-token" });
    const { accessToken } = await import("../src/auth");
    expect(await accessToken(config)).toBe("interactive-test-token");
    expect(mocks.popup).toHaveBeenCalledOnce();
  });
  it("does not hide unrelated token failures behind a popup", async () => {
    mocks.silent.mockRejectedValue(new Error("Token service unavailable"));
    const { accessToken } = await import("../src/auth");
    await expect(accessToken(config)).rejects.toThrow("Token service unavailable");
    expect(mocks.popup).not.toHaveBeenCalled();
  });
  it("blocks unsupported hosts and missing app registration", async () => {
    vi.stubGlobal("Office", {
      onReady: () => Promise.resolve(),
      context: { requirements: { isSetSupported: () => false } },
    });
    const { accessToken } = await import("../src/auth");
    await expect(accessToken(config)).rejects.toThrow("does not support nested app authentication");
    await expect(accessToken({ ...config, clientId: "" })).rejects.toThrow(
      "configure Microsoft Entra",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
