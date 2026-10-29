// Copyright © 2026 Christopher Snow
import { defineConfig } from "vite";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const commit = execSync("git rev-parse --short HEAD").toString().trim();
const dirty = execSync("git status --porcelain").toString().trim().length > 0;
export default defineConfig({
  base: "/benchmarking-lab/",
  build: {
    rollupOptions: {
      input: [
        resolve("index.html"),
        ...readdirSync("chapters")
          .filter((name) => name.endsWith(".html"))
          .map((name) => resolve("chapters", name)),
      ],
    },
  },
  define: {
    __BUILD__: JSON.stringify(`${commit}${dirty ? " · local changes" : ""}`),
  },
});
