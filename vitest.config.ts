import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["apps/worker/tests/**/*.test.ts", "scripts/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
