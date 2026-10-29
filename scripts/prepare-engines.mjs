// Copyright © 2026 Christopher Snow
// Copy the pinned engine resources verbatim. Nothing is fetched by this script.
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const copies = [
  ["@duckdb/duckdb-wasm", "duckdb-mvp.wasm"],
  ["@duckdb/duckdb-wasm", "duckdb-browser-mvp.worker.js"],
  ["@electric-sql/pglite", "pglite.wasm"],
  ["@electric-sql/pglite", "initdb.wasm"],
  ["@electric-sql/pglite", "pglite.data"],
];
await mkdir("public/engines", { recursive: true });
for (const [pkg, file] of copies) {
  await copyFile(`node_modules/${pkg}/dist/${file}`, `public/engines/${file}`);
}
const manifest = [];
for (const [pkg, file] of copies) {
  const bytes = await readFile(`public/engines/${file}`);
  const metadata = JSON.parse(
    await readFile(`node_modules/${pkg}/package.json`, "utf8"),
  );
  manifest.push({
    file,
    package: pkg,
    version: metadata.version,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  "public/engines/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
