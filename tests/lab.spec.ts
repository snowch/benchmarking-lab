// Copyright © 2026 Christopher Snow
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { compile } from "../src/benchmark";
import { median } from "../src/stats";

test("the real Wasm visits the fixture correctly in both orders, including 32-bit wrap", async () => {
  const source = await readFile(
    new URL("../src/kernel.wat", import.meta.url),
    "utf8",
  );
  for (const n of [1, 2, 7, 64, 256, 1024, 2048]) {
    const { scan } = await compile(source, n);
    const length = n * n,
      cycles = Math.floor(length / 251),
      remaining = length % 251;
    const expected =
      cycles * ((250 * 251) / 2) + (remaining * (remaining - 1)) / 2;
    for (const passes of [1, 3, 10]) {
      expect(scan(n, passes, 1, n) >>> 0).toBe(
        Math.imul(expected, passes) >>> 0,
      );
      expect(scan(n, passes, n, 1) >>> 0).toBe(
        Math.imul(expected, passes) >>> 0,
      );
    }
  }
  expect(median([100, 1, 3, 2])).toBe(2.5);
  expect(median([100, 1, 3])).toBe(3);
});

test("a browser run exports real samples with the measured settings and source", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("button", { name: "Run benchmark" }).click();
  await expect(page.locator("#status")).toContainText("Run complete", {
    timeout: 30000,
  });
  await expect(page.locator("#raw tr")).toHaveCount(40);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download run record" }).click();
  const download = await downloading;
  const record = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(record.settings.n).toBe(1024);
  expect(record.samples).toHaveLength(40);
  expect(record.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.settings.source).toContain('(export "scan")');
  for (const sample of record.samples) {
    expect(sample.elapsedMs).toBeGreaterThan(0);
    expect(sample.msPerPass).toBe(sample.elapsedMs / record.passes);
    expect(sample.checksum).toBe(record.expectedChecksum);
  }
  for (let i = 0; i < record.samples.length; i += 2) {
    expect(record.samples[i].order).not.toBe(record.samples[i + 1].order);
    if (i > 0)
      expect(record.samples[i].order).not.toBe(record.samples[i - 2].order);
  }
  await page.locator("#size").selectOption("64");
  await expect(page.locator("#stale")).toBeVisible();
  // The export still describes the run, not the newly edited controls.
  const again = page.waitForEvent("download");
  await page.locator("#download").click();
  expect(
    JSON.parse(await readFile((await (await again).path())!, "utf8")).settings
      .n,
  ).toBe(1024);
  expect(errors).toEqual([]);
});

test("edited source is actually compiled, wrong results rejected, and work survives reload", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByText("Inspect or edit the WebAssembly source", { exact: true })
    .click();
  const source = await page.locator("#source").inputValue();
  await page
    .locator("#source")
    .fill(
      source.replace("(i32.add (local.get $sum)", "(i32.add (i32.const 0)"),
    );
  await page.locator("#size").selectOption("64");
  await page.locator("#run").click();
  await expect(page.locator("#status")).toContainText("Incorrect result");
  await expect(page.locator("#results")).toBeHidden();
  await page
    .getByText("Notes and prediction (optional)", { exact: true })
    .click();
  await page.locator("#notes").fill("Compare 16 KiB with 16 MiB.");
  await page.reload();
  await expect(page.locator("#notes")).toHaveValue(
    "Compare 16 KiB with 16 MiB.",
  );
  await expect(page.locator("#size")).toHaveValue("64");
  await expect(page.locator("#source")).toHaveValue(
    source.replace("(i32.add (local.get $sum)", "(i32.add (i32.const 0)"),
  );
  await page
    .getByText("Inspect or edit the WebAssembly source", { exact: true })
    .click();
  await page.locator("#source").fill("(module broken");
  await page.locator("#run").click();
  await expect(page.locator("#status")).toHaveClass(/error/);
  await expect(page.locator("#run")).toBeEnabled();
  await page.locator("#restore").click();
  await page.locator("#run").click();
  await expect(page.locator("#status")).toContainText("Run complete", {
    timeout: 30000,
  });
});

test("an unbounded Wasm loop can be stopped and the runner recovers", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByText("Inspect or edit the WebAssembly source", { exact: true })
    .click();
  await page
    .locator("#source")
    .fill(
      '(module (func (export "scan") (param i32 i32 i32 i32) (result i32) (loop $forever (br $forever)) (i32.const 0)))',
    );
  await page.locator("#run").click();
  await expect(page.locator("#status")).toContainText("Warming");
  await page.locator("#cancel").click();
  await expect(page.locator("#status")).toContainText("Stopped.");
  await expect(page.locator("#run")).toBeEnabled();
  await page.locator("#restore").click();
  await page.locator("#size").selectOption("64");
  await page.locator("#samples").selectOption("10");
  await page.locator("#run").click();
  await expect(page.locator("#status")).toContainText("Run complete", {
    timeout: 30000,
  });
});

test("an unbounded edited module hits the wall-clock limit", async ({
  page,
}) => {
  await page.goto("./");
  await page.clock.install();
  await page
    .getByText("Inspect or edit the WebAssembly source", { exact: true })
    .click();
  await page
    .locator("#source")
    .fill(
      '(module (func (export "scan") (param i32 i32 i32 i32) (result i32) (loop $forever (br $forever)) (i32.const 0)))',
    );
  await page.locator("#run").click();
  await expect(page.locator("#status")).toContainText("Warming");
  await page.clock.fastForward(31000);
  await expect(page.locator("#status")).toContainText(
    "Stopped after 30 seconds",
  );
  await expect(page.locator("#results")).toBeHidden();
  await expect(page.locator("#run")).toBeEnabled();
});

test("trace, phone layout, theme and hints stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByLabel("Down columns", { exact: true }).check();
  await page.getByRole("button", { name: "Next read" }).click();
  await expect(page.locator("#trace-readout")).toContainText(
    "array index 4 · byte offset 16",
  );
  await page.locator("#step").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#trace-readout")).toContainText("array index 8");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (let i = 1; i <= 5; i++)
    await page.getByRole("button", { name: `Show hint · ${i} of 5` }).click();
  await expect(page.locator("#hints-list li")).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#size").selectOption("64");
  await page.locator("#run").click();
  await expect(page.locator("#status")).toContainText("Run complete", {
    timeout: 30000,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.locator("#chart circle")).toHaveCount(40);
  await expect(async () => {
    const bounds = await page.locator("#chart svg").evaluate((node) => {
      const svg = node as SVGSVGElement;
      const rect = svg.getBoundingClientRect();
      return {
        width: rect.width,
        viewWidth: svg.viewBox.baseVal.width,
        labelsFit: [...svg.querySelectorAll("text")].every((text) => {
          const label = text.getBoundingClientRect();
          return label.left >= rect.left - 1 && label.right <= rect.right + 1;
        }),
      };
    });
    expect(bounds.viewWidth).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.labelsFit).toBe(true);
  }).toPass();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the reading path and styling work without JavaScript", async ({
  browser,
}) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto("http://127.0.0.1:4173/benchmarking-lab/");
  await expect(
    page.getByRole("heading", { name: "A result needs its conditions." }),
  ).toBeVisible();
  await expect(page.locator("#run")).toBeDisabled();
  await expect(page.locator("noscript")).toBeVisible();
  expect(
    await page
      .locator("h1")
      .evaluate((node) => getComputedStyle(node).fontFamily),
  ).toContain("Georgia");
  await page.close();
});
