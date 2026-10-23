import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["apps/worker/worker-configuration.d.ts", "pnpm-lock.yaml"] },
  lint: {
    ignorePatterns: ["apps/worker/worker-configuration.d.ts"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/await-thenable": "error",
      "typescript/no-explicit-any": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
});
