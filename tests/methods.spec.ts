// Copyright © 2026 Christopher Snow
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function run(page: Page) {
  await page.locator("#methods-run").click();
  await expect(page.locator("#methods-run")).toBeEnabled({ timeout: 90000 });
  await expect(page.locator("#methods-status")).toContainText("Run complete");
  await expect(page.locator("#methods-download")).toBeEnabled();
}
async function evidence(page: Page) {
  const downloading = page.waitForEvent("download");
  await page.locator("#methods-download").click();
  return JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
}

test("real SQL rejects different work, then accepts the repaired January contract with index setup separate", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("chapters/03-equivalent-work.html");
  await run(page);
  await expect(page.locator("#methods-results")).toContainText(
    "Contract FAILED",
  );
  const failed = await evidence(page);
  expect(failed.expected).toEqual([
    ["1", "3", "450"],
    ["2", "2", "0"],
  ]);
  expect(failed.samples).toHaveLength(6);
  for (const sample of failed.samples) {
    expect(sample.verified).toBe(false);
    expect(sample.rows).toEqual([
      ["1", "5", "950"],
      ["2", "1", "0"],
    ]);
  }
  await page.locator("#methods-candidate").selectOption("repaired");
  await page.locator("#methods-index").selectOption("yes");
  await expect(page.locator("#methods-stale")).toBeVisible();
  const stillFailed = await evidence(page);
  expect(stillFailed.settings.candidate).toBe("incomplete");
  await run(page);
  await expect(page.locator("#methods-results")).toContainText(
    "Contract passed",
  );
  const repaired = await evidence(page);
  expect(repaired.samples).toHaveLength(6);
  for (const sample of repaired.samples) {
    expect(sample.verified).toBe(true);
    expect(sample.rows).toEqual([
      ["1", "3", "450"],
      ["2", "2", "0"],
    ]);
    expect(sample.elapsedMs).toBeGreaterThanOrEqual(0);
  }
  expect(
    repaired.phases.filter((p: { phase: string }) => p.phase === "index"),
  ).toHaveLength(2);
  expect(Object.keys(repaired.versions)).toEqual(["duckdb", "pglite"]);
  expect(repaired.assets).toHaveLength(5);
  expect(repaired.source.sharedModel).toContain(
    "export function expectedResults",
  );
  expect(errors).toEqual([]);
});

test("representative trace executes the selected mix and hotspot with independently checkable full rows", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("chapters/04-representative-workloads.html");
  await page.locator("#methods-shape").selectOption("hotspot");
  await page.locator("#methods-mix").selectOption("2");
  await run(page);
  const record = await evidence(page);
  expect(record.fixture.rows).toHaveLength(2000);
  expect(
    record.fixture.rows.filter((row: number[]) => row[2] === 1),
  ).toHaveLength(1800);
  expect(record.samples).toHaveLength(20);
  for (const engine of ["duckdb", "pglite"]) {
    const samples = record.samples.filter(
      (sample: { engine: string }) => sample.engine === engine,
    );
    expect(
      samples.filter((sample: { query: string }) => sample.query === "lookup"),
    ).toHaveLength(2);
    expect(
      samples.filter((sample: { query: string }) => sample.query === "revenue"),
    ).toHaveLength(8);
    for (const sample of samples)
      expect(sample.rows).toEqual(record.expected[sample.query]);
  }
  // Recompute revenue from the exported raw fixture, without the production reference helper.
  const totals = new Map<string, number>();
  for (const [, month, region, cents] of record.fixture.rows)
    totals.set(
      `${month},${region}`,
      (totals.get(`${month},${region}`) ?? 0) + cents,
    );
  const expected = [...totals]
    .map(([key, sum]) => [...key.split(","), String(sum)])
    .sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]));
  for (const sample of record.samples.filter(
    (sample: { query: string }) => sample.query === "revenue",
  ))
    expect(sample.rows).toEqual(expected);
  await expect(page.locator("#methods-results")).toContainText(
    "calculated planning summary",
  );
});

test("scheduled arrivals expose client waiting and keep every offered work item in the evidence", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("chapters/05-trust-the-benchmark.html");
  await page.locator("#methods-arrival").selectOption("scheduled");
  await page.locator("#methods-pause").selectOption("20");
  await run(page);
  const record = await evidence(page);
  expect(record.accounting).toEqual({
    offered: 12,
    submitted: 12,
    completed: 12,
    errors: 0,
    pending: 0,
  });
  expect(record.workItems).toHaveLength(12);
  expect(record.samples).toHaveLength(12);
  record.samples.forEach(
    (sample: Record<string, number | boolean>, index: number) => {
      expect(sample.intendedMs).toBe(index * 5);
      expect(Number(sample.enqueuedMs)).toBeGreaterThanOrEqual(
        Number(sample.intendedMs),
      );
      expect(Number(sample.submittedMs)).toBeGreaterThanOrEqual(
        Number(sample.enqueuedMs),
      );
      expect(Number(sample.completedMs)).toBeGreaterThanOrEqual(
        Number(sample.submittedMs),
      );
      expect(sample.verified).toBe(true);
      if (index > 0)
        expect(Number(sample.submittedMs)).toBeGreaterThanOrEqual(
          record.samples[index - 1].completedMs,
        );
    },
  );
  const final = record.samples.at(-1);
  expect(final.completedMs - final.intendedMs).toBeGreaterThan(150);
  await page.locator("#methods-arrival").selectOption("closed");
  await run(page);
  const closed = await evidence(page);
  for (let index = 1; index < closed.samples.length; index++)
    expect(closed.samples[index].intendedMs).toBeGreaterThanOrEqual(
      closed.samples[index - 1].completedMs,
    );
});

test("setup failure and Stop retain an explicitly incomplete downloadable runner record", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/engines/manifest.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("chapters/05-trust-the-benchmark.html");
  await page.locator("#methods-run").click();
  await expect(page.locator("#methods-status")).toContainText("Run failed");
  const failed = await evidence(page);
  expect(failed.error).toContain("manifest");
  expect(failed.accounting).toEqual({
    offered: 0,
    submitted: 0,
    completed: 0,
    errors: 0,
    pending: 0,
  });
  await page.unroute("**/engines/manifest.json");
  await page.locator("#methods-run").click();
  await expect(page.locator("#methods-status")).toContainText(
    "Starting DuckDB",
  );
  await page.locator("#methods-stop").click();
  await expect(page.locator("#methods-run")).toBeEnabled();
  const stopped = await evidence(page);
  expect(stopped.outcome).toContain("Stopped");
  expect(stopped.samples).toEqual([]);
  // Stop after arrivals begin, then verify the offered population stays fully accounted for.
  await page.locator("#methods-arrival").selectOption("scheduled");
  await page.locator("#methods-pause").selectOption("20");
  await page.locator("#methods-run").click();
  await page.waitForFunction(
    () =>
      document
        .getElementById("methods-status")!
        .textContent!.startsWith("Offered "),
    undefined,
    { timeout: 90000 },
  );
  await page.locator("#methods-stop").click();
  await expect(page.locator("#methods-run")).toBeEnabled();
  const interrupted = await evidence(page);
  expect(interrupted.outcome).toContain("Stopped");
  expect(interrupted.accounting.offered).toBeGreaterThan(0);
  expect(interrupted.accounting.offered).toBe(
    interrupted.accounting.completed +
      interrupted.accounting.errors +
      interrupted.accounting.pending,
  );
  expect(interrupted.workItems).toHaveLength(interrupted.accounting.offered);
  expect(errors).toEqual([]);
});

test("methods lessons keep drafts, stay within phone width and remain readable without JavaScript", async ({
  page,
  browser,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 320, height: 844 });
  for (const filename of [
    "03-equivalent-work.html",
    "04-representative-workloads.html",
    "05-trust-the-benchmark.html",
  ]) {
    await page.goto(`chapters/${filename}`);
    await expect(page.locator(".book-contents")).not.toHaveAttribute("open");
    await page
      .locator("#methods-notes")
      .fill("The customer contract determines the next test.");
    await page.reload();
    await expect(page.locator("#methods-notes")).toHaveValue(
      "The customer contract determines the next test.",
    );
    await page.locator("#experiment details summary").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    requests.some((url) => /\.wasm|\.data|database\.worker/.test(url)),
  ).toBe(false);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 844 },
  });
  const plain = await context.newPage();
  for (const filename of [
    "03-equivalent-work.html",
    "04-representative-workloads.html",
    "05-trust-the-benchmark.html",
  ]) {
    await plain.goto(`chapters/${filename}`);
    await expect(plain.locator("noscript")).toBeVisible();
    await expect(plain.locator("#methods-run")).toBeDisabled();
    await expect(plain.locator("#practice")).toContainText(
      "Independent practice",
    );
    expect(
      await plain.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await context.close();
});
