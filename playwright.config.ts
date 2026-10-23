import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "apps/outlook-addin/tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: "http://localhost:8788",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 420, height: 900 },
  },
  webServer: {
    command:
      "pnpm build:web && pnpm exec wrangler d1 migrations apply posthop-browser-tests --local --config apps/outlook-addin/tests/worker/wrangler.jsonc && pnpm exec wrangler dev --local --ip 127.0.0.1 --port 8788 --config apps/outlook-addin/tests/worker/wrangler.jsonc",
    url: "http://localhost:8788/api/config",
    timeout: 120000,
    reuseExistingServer: false,
  },
  reporter: "list",
});
