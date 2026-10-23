import {
  createNestablePublicClientApplication,
  InteractionRequiredAuthError,
  type IPublicClientApplication,
} from "@azure/msal-browser";
export interface Config {
  localMock: boolean;
  providerMode: "mock" | "smtp2go";
  clientId: string;
  tenantId: string;
  scope: string;
}
let client: IPublicClientApplication | undefined;
export async function accessToken(config: Config): Promise<string> {
  if (config.localMock) return "local-development-only";
  if (!config.clientId || !config.tenantId)
    throw new Error("Administrator must configure Microsoft Entra authentication.");
  const host = await Office.onReady();
  if (host.host !== Office.HostType.Outlook)
    throw new Error("Open Posthop from an Outlook compose window to sign in.");
  if (!Office.context.requirements.isSetSupported("NestedAppAuth", "1.1"))
    throw new Error(
      "This Outlook/browser does not support nested app authentication. Use a supported Outlook on the web session.",
    );
  client ??= await createNestablePublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
    cache: { cacheLocation: "memoryStorage" },
  });
  const request = {
    scopes: [config.scope],
    account: client.getActiveAccount() ?? client.getAllAccounts()[0],
  };
  try {
    return (await client.acquireTokenSilent(request)).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError)
      return (await client.acquireTokenPopup(request)).accessToken;
    throw e;
  }
}
