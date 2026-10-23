import { defineConfig } from "vite-plus";
export default defineConfig({
  test: {
    include: [
      "apps/worker/tests/**/*.test.ts",
      "apps/outlook-addin/tests/**/*.test.ts",
      "scripts/*.test.ts",
    ],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
