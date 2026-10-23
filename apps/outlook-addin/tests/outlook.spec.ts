import { test, expect } from "@playwright/test";
import { mockOutlook } from "./office-fixture";

test("Office compose snapshot, explicit metadata write and recovery after closing the pane", async ({
  page,
  context,
}) => {
  await mockOutlook(page);
  await page.goto("/");
  const prepare = page.getByRole("button", { name: "Prepare Outlook draft" });
  await expect(prepare).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("office-test-save-count"))).toBeNull();
  await prepare.click();
  await expect(page.getByRole("heading", { name: "Outlook compose contract test" })).toBeVisible();
  await expect(page.frameLocator("iframe").getByText("Arrive at 6 pm.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("office-test-save-count"))).toBe("1");
  await page.getByLabel("Recipient email").fill("controlled@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit simulated message" }).click();
  await expect(page.getByRole("heading", { name: "Durably submitted" })).toBeVisible();
  const id = await page.locator('[role="status"] code').textContent();
  await page.close();
  const reopened = await context.newPage();
  await mockOutlook(reopened);
  await reopened.goto("/");
  await expect(reopened.getByRole("heading", { name: "Durably submitted" })).toBeVisible();
  await expect(reopened.locator('[role="status"] code')).toHaveText(id!);
  await reopened.getByRole("button", { name: "Refresh status" }).click();
  await expect(
    reopened.getByText("Provider accepted: 1 · Delivery: not yet reported"),
  ).toBeVisible();
  expect(await reopened.evaluate(() => localStorage.getItem("office-test-save-count"))).toBe("1");
});

test("draft changes after review block submission", async ({ page }) => {
  await mockOutlook(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare Outlook draft" }).click();
  await page.getByLabel("Recipient email").fill("controlled@example.com");
  await page.getByRole("checkbox").check();
  await page.evaluate(() =>
    localStorage.setItem(
      "office-test-draft",
      JSON.stringify({ subject: "Changed subject", html: "<p>Changed</p>", text: "Changed" }),
    ),
  );
  await page.getByRole("button", { name: "Submit simulated message" }).click();
  await expect(
    page.getByText("Draft changed. Prepare and review the updated message before sending."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Durably submitted" })).toHaveCount(0);
});

test("failed metadata save prevents preparing or sending", async ({ page }) => {
  await mockOutlook(page, { saveFailure: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare Outlook draft" }).click();
  await expect(page.getByText("Draft metadata could not be saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit simulated message" })).toBeDisabled();
});

test("attachments are rejected before any metadata write", async ({ page }) => {
  await mockOutlook(page, { attachments: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare Outlook draft" }).click();
  await expect(
    page.getByText(
      "Attachments and inline images are not supported. Remove them before preparing this message.",
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("office-test-save-count"))).toBeNull();
});

test("authenticated mock mode is disclosed without enabling local auth bypass", async ({
  page,
}) => {
  await mockOutlook(page);
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        localMock: false,
        providerMode: "mock",
        clientId: "test-client",
        tenantId: "test-tenant",
        scope: "api://test-api/Mail.Send.External",
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Mock delivery. No email will be delivered.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to Microsoft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare Outlook draft" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit simulated message" })).toBeDisabled();
});
