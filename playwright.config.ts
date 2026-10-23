import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "apps/outlook-addin/tests",
  use: {
    baseURL: "http://localhost:8787",
    viewport: { width: 420, height: 900 },
  },
  webServer: {
    command:
      "pnpm db:local && pnpm build:web && pnpm --dir apps/worker exec wrangler dev --local --ip 127.0.0.1 --port 8787 --var APP_ENV:local --var PROVIDER_MODE:mock --var DEV_AUTH_TOKEN:local-development-only",
    url: "http://localhost:8787/api/config",
    timeout: 120000,
    reuseExistingServer: false,
  },
  reporter: "list",
});
