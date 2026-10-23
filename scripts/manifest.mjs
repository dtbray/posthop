import { readFile, writeFile } from "node:fs/promises";
const origin = new URL(process.argv[2] ?? "https://localhost:3000");
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error(
    "Supply an HTTPS origin without a path, credentials, query or fragment",
  );
const source = await readFile(
  "apps/outlook-addin/manifest/manifest.xml",
  "utf8",
);
await writeFile(
  "apps/outlook-addin/manifest/manifest.generated.xml",
  source.replaceAll("https://localhost:3000", origin.origin),
);
console.log("Generated apps/outlook-addin/manifest/manifest.generated.xml");
