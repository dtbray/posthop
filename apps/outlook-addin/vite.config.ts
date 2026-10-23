import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const certFile = process.env.TLS_CERT_FILE,
  keyFile = process.env.TLS_KEY_FILE;
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "localhost",
    https:
      certFile && keyFile
        ? { cert: readFileSync(certFile), key: readFileSync(keyFile) }
        : undefined,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
