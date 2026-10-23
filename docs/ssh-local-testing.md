# Testing Outlook through an SSH tunnel

When Posthop runs on a remote development machine, the browser's `localhost` is your local computer. An SSH forward connects that local address to the remote Vite server while preserving the origin that Outlook and Entra expect.

## Start the remote services

Keep the Worker on remote loopback port 8787 and the HTTPS pane on a free loopback port, for example 3001:

```sh
pnpm db:local
pnpm --dir apps/worker exec wrangler dev --local --ip 127.0.0.1 --port 8787
# In another remote terminal:
pnpm dev:web --port 3001 --host 127.0.0.1
```

The SPA's broker redirect must match `brk-multihub://localhost:3001`. Generate its matching manifest with `node scripts/manifest.mjs https://localhost:3001`. The source manifest remains a template. Use the generated file for this test origin.

## Forward the pane

In a terminal on your **local computer**, using your normal SSH account/host or alias:

```sh
ssh -N -L 127.0.0.1:3001:127.0.0.1:3001 user@ssh-host
```

Keep that process open. Browse to **https://localhost:3001**. The pane proxies its API calls to the remote Worker; a second forward for port 8787 is unnecessary. A conflict on local port 3001 must be resolved or handled by choosing another consistent local origin/registration/manifest. Do not silently change one port and leave the other pieces pointing elsewhere.

## Trust the development certificate locally

The remote machine's trust store is separate from your local browser's. For a Microsoft development certificate, copy **only the public CA certificate** to your local computer:

```sh
scp user@ssh-host:~/.office-addin-dev-certs/ca.crt ./posthop-dev-ca.crt
```

Import that CA into the trusted development roots used by your local browser/OS. Reopen the browser if its trust store requires it. A successful certificate-error bypass is not the trusted-HTTPS gate for Outlook. The private `localhost.key` stays on the remote machine in ignored local storage. Regenerating certificates requires updating the remote pane files and, if the CA changed, the browser's trusted CA.

## Open inside Outlook

A normal browser tab is a preview: it cannot read an Outlook draft or use Outlook's authentication broker, so those actions remain disabled. For the real test:

1. Save the generated XML locally from `https://localhost:3001/manifest/manifest.generated.xml` through the tunnel, or copy that generated file using SCP.
2. Open the [Outlook sideload dialog](https://aka.ms/olksideload) in the authorized mailbox. Under My add-ins, add the custom add-in from the generated file, following tenant policy.
3. Compose a new message and open Posthop from the compose add-ins menu.
4. Sign in through the task pane. Start with real Entra authentication and **mock delivery**, and verify its durable outcome before enabling the restricted SMTP2GO test key.

## Troubleshooting

- Connection refused: check both the SSH forward and the remote `127.0.0.1:3001` listener.
- Wrong app/page: check local port conflicts and that the manifest, browser URL and broker redirect use the same origin.
- Certificate warning: install the public development CA on the browser's computer, not only on the remote server.
- Disabled draft/sign-in controls in a normal tab: open the add-in inside Outlook compose.
- Office library error: check that the browser can load Microsoft's Office.js CDN; the pane reports this separately from API authentication errors.
