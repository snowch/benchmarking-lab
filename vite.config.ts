// Copyright © 2026 Christopher Snow
import { defineConfig } from "vite";
import { execSync } from "node:child_process";

const commit = execSync("git rev-parse --short HEAD").toString().trim();
const dirty = execSync("git status --porcelain").toString().trim().length > 0;
export default defineConfig({
  base: "/benchmarking-lab/",
  define: {
    __BUILD__: JSON.stringify(`${commit}${dirty ? " · local changes" : ""}`),
  },
});
