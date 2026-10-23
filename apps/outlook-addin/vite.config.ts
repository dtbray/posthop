import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
// Fixed, project-local paths: certificate selection cannot traverse arbitrary files.
const certFile = new URL("../../.certs/localhost.crt", import.meta.url);
const keyFile = new URL("../../.certs/localhost.key", import.meta.url);
const hasCertificates = existsSync(certFile) && existsSync(keyFile);
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "localhost",
    https: hasCertificates
      ? { cert: readFileSync(certFile), key: readFileSync(keyFile) }
      : undefined,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
