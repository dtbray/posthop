# Entra test registration contract

The local Outlook integration uses two isolated, single-tenant registrations:

| Registration                 | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| Posthop API (local test)     | Defines the delegated API scope and token audience |
| Posthop Outlook (local test) | Public MSAL client used by the task pane           |

No client secret is required. These registrations do not need Graph Mail.Send, Exchange send-as, mailbox read/write, SMTP AUTH or a subscription deployment. Staff authorization still comes from the Worker's explicit object-ID allowlist.

## Configuration

1. Create the API registration with `AzureADMyOrg` sign-in audience. Set its identifier URI to `api://<API-client-UUID>` and requested access-token version to 2.
2. Define the enabled delegated `Mail.Send.External` scope. Its consent description should clearly authorize submission through Posthop. Use administrative consent for this external-send capability.
3. Create the Outlook SPA registration in the same tenant. Add the SPA broker redirect `brk-multihub://localhost:3000`; no path is appended.
4. Add the API delegated scope to the SPA's required resource access. Create the application's service principals in the tenant if provisioning through Microsoft Graph.
5. Preauthorize **only this SPA** for the API scope, or complete the tenant's applicable consent process. When using Graph, persist the API scope before adding `preAuthorizedApplications`; a first update that references a not-yet-persisted scope can fail validation.
6. Set `TENANT_ID`, `API_AUDIENCE` (the API client UUID), `CLIENT_ID` (SPA UUID) and `ALLOWED_OBJECT_IDS` in ignored local configuration. For the first real authentication test use `APP_ENV=production` and `PROVIDER_MODE=mock`. This requires a real API access token but cannot send mail.

Do not reuse or edit unrelated tenant apps. Test registrations should have a clear local-test marker and owner. Keep IDs and account-specific test records out of public examples. When moving to a hosted test origin, add its specific broker redirect deliberately; do not add broad redirect patterns.

## Live test sequence

Use trusted HTTPS on port 3000 and the existing XML manifest. Sideload into the authorized Outlook web test mailbox. Sign in from the task pane; prepare a fresh draft; submit to the controlled inbox while provider mode is mock. Verify that the backend accepts the tenant API access token and that the durable batch finishes with a `mock-` provider ID.

Only after that succeeds should provider mode switch to `smtp2go` with the restricted sending key, verified sender, monitored reply mailbox and explicit controlled recipient. Compose a **new draft** for the real send; a mock batch's frozen mode must never be converted into a live send. Check both the received message and SMTP2GO activity before calling the integration gate complete.

[Microsoft NAA setup](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/enable-nested-app-authentication-in-your-add-in) and [Graph application provisioning](https://learn.microsoft.com/en-us/graph/api/application-post-applications?view=graph-rest-1.0) are the authoritative setup references.
