// Copyright © 2026 Christopher Snow
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  generateOrders,
  expectedResults,
  loadStatements,
  queries,
  ENGINES,
  type Sample,
} from "../src/database-model";

async function expectPlottedSamples(page: Page, samples: Sample[]) {
  await expect(page.locator("#db-plots svg")).toHaveCount(2);
  for (const query of ["lookup", "revenue"]) {
    const plot = page.locator(`#db-plots [data-query="${query}"]`);
    const axis = await plot.locator("svg").evaluate((svg: SVGSVGElement) => {
      const ticks = svg.querySelectorAll<SVGTextElement>(".db-plot-tick");
      return {
        origin: Number(ticks[0].getAttribute("x")),
        end: Number(ticks[ticks.length - 1].getAttribute("x")),
        maximum: Number(svg.dataset.maximumMs),
      };
    });
    expect(axis.maximum).toBeGreaterThan(0);
    for (const engine of ENGINES) {
      const group = plot.locator(`[data-engine="${engine}"]`);
      const values = samples
        .filter((sample) => sample.query === query && sample.engine === engine)
        .map((sample) => sample.elapsedMs);
      const points = await group.locator("circle").evaluateAll((circles) =>
        circles.map((circle) => ({
          value: Number(circle.getAttribute("data-elapsed-ms")),
          x: Number(circle.getAttribute("cx")),
        })),
      );
      expect(points.map((point) => point.value)).toEqual(values);
      for (const point of points)
        expect((point.x - axis.origin) / (axis.end - axis.origin)).toBeCloseTo(
          point.value / axis.maximum,
          8,
        );
      const sorted = [...values].sort((a, b) => a - b);
      const middle = sorted[Math.floor(sorted.length / 2)];
      await expect(group.locator(".db-plot-median")).toHaveAttribute(
        "data-median-ms",
        String(middle),
      );
      await expect(group.locator(".db-plot-median-label")).toHaveText(
        `Median ${middle.toFixed(3)} ms`,
      );
    }
  }
  await expect(page.locator("#db-finding")).toContainText(
    "in this browser run",
  );
}

test("real shipped database engines verify both queries and export the measured snapshot", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const external: string[] = [];
  const engineRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") external.push(request.url());
    if (/engines|\.wasm|\.data|database\.worker/.test(url.pathname))
      engineRequests.push(url.pathname);
  });
  await page.goto("chapters/02-duckdb-postgres.html");
  await expect(page.locator("#db-status")).toContainText(
    "No database engine has been loaded",
  );
  expect(engineRequests).toEqual([]);
  await page.locator("#db-run").click();
  await expect(page.locator("#db-status")).toContainText("Run complete", {
    timeout: 90000,
  });
  await expect(page.locator("#db-run")).toBeEnabled();
  await expect(page.locator("#db-summary tr")).toHaveCount(4);
  await expect(page.locator("#db-samples tr")).toHaveCount(20);
  await expect(page.locator("#db-phases tr")).toHaveCount(10);
  expect(engineRequests).toContain("/benchmarking-lab/engines/duckdb-mvp.wasm");
  expect(engineRequests).toContain("/benchmarking-lab/engines/pglite.wasm");
  expect(engineRequests).toContain("/benchmarking-lab/engines/initdb.wasm");
  expect(engineRequests).toContain("/benchmarking-lab/engines/pglite.data");
  await page.locator("#db-size").selectOption("20000");
  await expect(page.locator("#db-stale")).toBeVisible();
  await page
    .locator("#db-claim")
    .fill(
      "Under these browser conditions, compare each request separately. Next test an indexed lookup.",
    );
  const downloading = page.waitForEvent("download");
  await page.locator("#db-download").click();
  const record = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  await expectPlottedSamples(page, record.samples);
  await expect(page.locator("#db-exact-values")).not.toHaveAttribute("open");
  expect(record.format).toBe("benchmarking-lab-databases-v1");
  expect(record.settings.rows).toBe(2000);
  expect(record.settings.sql).toEqual(queries(2000));
  expect(record.settings.setup).toBe("ANALYZE orders;");
  expect(record.fixture.loadSql).toEqual(loadStatements(generateOrders(2000)));
  expect(record.fixture.loadSqlSha256).toBe(
    createHash("sha256")
      .update(record.fixture.loadSql.join("\n"))
      .digest("hex"),
  );
  expect(record.fixture.source).toContain("export function generateOrders");
  expect(record.interpretation.conditionalClaimAndNextCheck).toContain(
    "indexed lookup",
  );
  expect(record.assets).toHaveLength(5);
  for (const asset of record.assets) {
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.bytes).toBeGreaterThan(100000);
  }
  const expected = expectedResults(generateOrders(2000), 1000);
  for (const engine of ENGINES) {
    expect(record.engines[engine].runtimeVersion.length).toBeGreaterThan(5);
    const phases = record.phases.filter(
      (phase: { engine: string }) => phase.engine === engine,
    );
    expect(phases.map((phase: { phase: string }) => phase.phase)).toEqual([
      "startup",
      "load",
      "analyze",
      "verification",
      "warmup",
    ]);
    for (const phase of phases)
      expect(phase.elapsedMs).toBeGreaterThanOrEqual(0);
  }
  expect(record.engines.duckdb.package).toContain("1.32.0");
  expect(record.engines.pglite.package).toContain("0.5.13");
  expect(record.engines.pglite.runtimeVersion).toContain("PostgreSQL");
  expect(record.method.queryBoundary).toContain("One query per request");
  expect(record.samples).toHaveLength(20);
  for (const sample of record.samples) {
    expect(sample.rows).toEqual(
      expected[sample.query as keyof typeof expected],
    );
    expect(sample.verified).toBe(true);
    expect(sample.elapsedMs).toBeGreaterThanOrEqual(0);
  }
  for (let index = 0; index < record.samples.length; index += 2) {
    expect(record.samples[index].position).toBe(1);
    expect(record.samples[index + 1].position).toBe(2);
    expect(record.samples[index].engine).not.toBe(
      record.samples[index + 1].engine,
    );
    if (
      index > 0 &&
      record.samples[index].query === record.samples[index - 2].query
    )
      expect(record.samples[index].engine).not.toBe(
        record.samples[index - 2].engine,
      );
  }
  await page.locator("#db-run").click();
  await expect(page.locator("#db-status")).toContainText("Run complete", {
    timeout: 90000,
  });
  await expect(page.locator("#db-run")).toBeEnabled();
  await expect(page.locator("#db-history option")).toHaveCount(2);
  await expect(page.locator("#db-run-label")).toContainText("20,000 orders");
  await expect(page.locator("#db-stale")).toBeHidden();
  const secondDownload = page.waitForEvent("download");
  await page.locator("#db-download").click();
  const secondRecord = JSON.parse(
    await readFile((await (await secondDownload).path())!, "utf8"),
  );
  expect(secondRecord.settings.rows).toBe(20000);
  expect(secondRecord.fixture.loadSql).toEqual(
    loadStatements(generateOrders(20000)),
  );
  const secondExpected = expectedResults(generateOrders(20000), 10000);
  for (const sample of secondRecord.samples)
    expect(sample.rows).toEqual(
      secondExpected[sample.query as keyof typeof secondExpected],
    );
  await page.locator("#db-history").selectOption("1");
  await expectPlottedSamples(page, record.samples);
  await expect(page.locator("#db-run-label")).toContainText("2,000 orders");
  await expect(page.locator("#db-stale")).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("stop discards an unfinished real engine run, restores controls and allows a fresh run", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("chapters/02-duckdb-postgres.html");
  await page.locator("#db-run").click();
  await expect(page.locator("#db-status")).toContainText("Starting DuckDB");
  await page.locator("#db-stop").click();
  await expect(page.locator("#db-status")).toContainText("Stopped");
  await expect(page.locator("#db-run")).toBeEnabled();
  await expect(page.locator("#db-stop")).toBeDisabled();
  await expect(page.locator("#db-results")).toBeHidden();
  await expect(page.locator("#db-size")).toBeEnabled();
  await page.locator("#db-run").click();
  await expect(page.locator("#db-status")).toContainText("Run complete", {
    timeout: 90000,
  });
  await expect(page.locator("#db-run")).toBeEnabled();
  await expect(page.locator("#db-samples tr")).toHaveCount(20);
  await expect(page.locator("#db-history option")).toHaveCount(1);
});

test("phone layout keeps the source readable and preserves the practice draft", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("chapters/02-duckdb-postgres.html");
  await expect(page.locator(".book-contents")).not.toHaveAttribute("open", "");
  await page.locator("#db-size").selectOption("20000");
  await page.locator("#db-repeats").selectOption("9");
  await page.locator("#db-notes").evaluate((node: HTMLTextAreaElement) => {
    node.closest("details")!.open = true;
  });
  await page
    .locator("#db-notes")
    .fill("Look at both jobs before making the claim.");
  await page
    .locator("#db-claim")
    .fill("Browser builds, one client, no index. Next check indexing.");
  await page.reload();
  await expect(page.locator("#db-size")).toHaveValue("20000");
  await expect(page.locator("#db-repeats")).toHaveValue("9");
  await expect(page.locator("#db-notes")).toHaveValue(
    "Look at both jobs before making the claim.",
  );
  await expect(page.locator("#db-claim")).toHaveValue(
    "Browser builds, one client, no index. Next check indexing.",
  );
  await expect(page.locator("#db-lookup-sql")).toContainText(
    "order_id = 10000",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator("#db-run").click();
  await expect(page.locator("#db-status")).toContainText("Run complete", {
    timeout: 90000,
  });
  await expect(page.locator("#db-samples tr")).toHaveCount(36);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("#db-plots circle")).toHaveCount(36);
  for (const width of [390, 320, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.locator("#db-plots svg").evaluateAll((nodes) =>
          nodes.every((node) => {
            const svg = node as SVGSVGElement;
            return Math.abs(svg.viewBox.baseVal.width - svg.clientWidth) < 1;
          }),
        ),
      )
      .toBe(true);
    expect(
      await page.locator("#db-plots svg").evaluateAll((nodes) =>
        nodes.every((node) => {
          const svg = node as SVGSVGElement,
            bounds = svg.getBoundingClientRect();
          return (
            Math.abs(svg.getScreenCTM()!.a - 1) < 0.01 &&
            [...svg.querySelectorAll("text")].every((text) => {
              const rect = text.getBoundingClientRect();
              return (
                rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
              );
            })
          );
        }),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#db-plots").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/database-phone-results.png" });
  await page.locator("#db-exact-values > summary").click();
  await expect(page.locator("#db-summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the full lesson, schema and SQL remain readable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("chapters/02-duckdb-postgres.html");
  await expect(page.locator("noscript .notice")).toContainText(
    "chapter and SQL are readable",
  );
  await expect(page.locator("noscript .notice")).toBeVisible();
  await expect(page.locator("#db-run")).toBeDisabled();
  await expect(page.locator("#db-lookup-sql")).toContainText("order_id = 1000");
  await expect(page.locator("#practice h2")).toHaveText(
    "Write a claim someone else can check",
  );
  await page
    .getByText("See the complete schema and deterministic data recipe", {
      exact: true,
    })
    .click();
  await expect(
    page.getByText("CREATE TABLE orders (", { exact: false }),
  ).toBeVisible();
  await context.close();
});
