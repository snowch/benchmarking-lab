// Copyright © 2026 Christopher Snow.
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve("dist");
const pages = [
  "index.html",
  ...(await readdir(join(root, "chapters")))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `chapters/${name}`),
];
const ids = new Map();
const failures = [];
for (const page of pages) {
  const html = await readFile(join(root, page), "utf8");
  const values = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  ids.set(page, new Set(values));
  if (values.length !== new Set(values).size)
    failures.push(`${page}: duplicate IDs`);
}
let checked = 0;
for (const page of pages) {
  const html = await readFile(join(root, page), "utf8");
  for (const [, raw] of html.matchAll(/\bhref="([^"]+)"/g)) {
    const url = new URL(
      raw.replaceAll("&amp;", "&"),
      `https://book.local/benchmarking-lab/${page}`,
    );
    if (url.origin !== "https://book.local") continue;
    const path = decodeURIComponent(url.pathname).replace(
      /^\/benchmarking-lab\//,
      "",
    );
    if (path.startsWith("/")) {
      failures.push(`${page}: ${raw} escapes the Pages base`);
      continue;
    }
    const target = !path || path.endsWith("/") ? `${path}index.html` : path;
    try {
      if (!(await stat(join(root, target))).isFile())
        throw new Error("not a file");
      if (
        url.hash &&
        ids.has(target) &&
        !ids.get(target).has(decodeURIComponent(url.hash.slice(1)))
      )
        throw new Error("missing fragment");
      checked++;
    } catch {
      failures.push(`${page}: missing destination ${raw}`);
    }
  }
}
if (failures.length) throw new Error(failures.join("\n"));
console.log(
  `${pages.length} pages: ${checked} internal links and fragment destinations verified.`,
);
