import { test, expect } from "@playwright/test";
test("review, import correction, durable mock submission and reopening", async ({ page }) => {
  // Standalone mock preview only; actual Office integration has a separate manual gate.
  await page.route("https://appsforoffice.microsoft.com/**", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: 'window.Office={HostType:{Outlook:"Outlook"},onReady:()=>Promise.resolve({host:null})};',
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Local simulation. No email will be delivered.")).toBeVisible();
  await page.getByRole("button", { name: "Prepare sample draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Your event arrival instructions" }),
  ).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByText("We look forward to seeing you"),
  ).toBeVisible();
  await page.getByText("Inspect a CSV export").click();
  await page
    .getByLabel("Editable CSV")
    .fill("email,first_name\ntest@example.com,Jane\nTEST@example.com,Jane\ninvalid,Other");
  await expect(page.getByText("1 valid unique recipients · 1 duplicate rows")).toBeVisible();
  await expect(page.getByText("Row 4: invalid or missing email.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Select test@example.com" })).toBeDisabled();
  await page.getByLabel("Editable CSV").fill("email,first_name\ntest@example.com,Jane");
  await page.getByRole("button", { name: "Select test@example.com" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit simulated message" }).click();
  await expect(page.getByRole("heading", { name: "Durably submitted" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("Provider accepted: 1 · Delivery: not yet reported")).toBeVisible();
  const code = await page.locator('[role="status"] code').textContent();
  await expect(
    page.frameLocator("iframe").getByText("We look forward to seeing you"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/local-pane.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Prepare sample draft" }).click();
  await expect(page.getByRole("heading", { name: "Durably submitted" })).toBeVisible();
  await expect(page.locator('[role="status"] code')).toHaveText(code!);
});
