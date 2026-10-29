// Copyright © 2026 Christopher Snow
import { test, expect } from "@playwright/test";
import {
  pairedEstimate,
  parsePairs,
  parseRequests,
  requestSummary,
  parseSteps,
  qualifies,
  percentile,
} from "../src/statistics-model";

test("paired log intervals retain runs as independent units and reciprocal direction", () => {
  const rows = parsePairs(
    "run,a_ms,b_ms\n1,120,100\n2,108,100\n3,132,100\n4,114,100\n5,126,100",
  );
  const result = pairedEstimate(rows);
  expect(result.n).toBe(5);
  expect(result.ratio).toBeCloseTo(1.19699, 4);
  expect(result.low).toBeCloseTo(1.0847, 3);
  expect(result.high).toBeCloseTo(1.3208, 3);
  const inverse = pairedEstimate(rows.map((r) => ({ ...r, a: r.b, b: r.a })));
  expect(inverse.low).toBeCloseTo(1 / result.high, 12);
  expect(inverse.high).toBeCloseTo(1 / result.low, 12);
  expect(() => parsePairs("run,a_ms,b_ms\n1,0,1\n2,1,1")).toThrow(/positive/);
  expect(() => parsePairs("run,a_ms,b_ms\n1,1,1\n1,1,1")).toThrow(/unique/);
});

test("nearest-rank tails and planned waiting use the declared successful population", () => {
  const rows = parseRequests(
    "id,planned_ms,sent_ms,finished_ms,status\na,0,0,20,ok\nb,100,400,450,ok\nc,200,200,300,error\nd,300,300,500,timeout\ne,500,500,,pending",
    1000,
  );
  const sent = requestSummary(rows, 1000, false),
    planned = requestSummary(rows, 1000, true);
  expect(sent.p99).toBe(50);
  expect(planned.p99).toBe(350);
  expect(sent.ok + sent.errors + sent.timeouts + sent.pending).toBe(
    sent.offered,
  );
  expect(sent.goodput).toBe(2);
  expect(planned.mean).toBe(185);
  expect(percentile([1, 2, 3, 4, 5, 6, 7], 0.99)).toBe(7);
  expect(() =>
    parseRequests(
      "id,planned_ms,sent_ms,finished_ms,status\na,100,50,70,ok",
      1000,
    ),
  ).toThrow(/planned/);
});

test("capacity qualification checks queues and failures as well as latency", () => {
  const rows = parseSteps(
    "option,offered_rps,seconds,ok,error,timeout,start_pending,end_pending,p99_ms,server_cpu_pct,client_cpu_pct\nA,200,60,12000,0,0,0,0,120,70,35\nB,200,60,11400,0,300,0,300,180,96,35",
  );
  expect(qualifies(rows[0], 150, 1)).toBe(true);
  expect(qualifies(rows[1], 200, 1)).toBe(false);
  expect(qualifies(rows[1], 200, 100)).toBe(false);
  expect(() =>
    parseSteps(
      "option,offered_rps,seconds,ok,error,timeout,start_pending,end_pending,p99_ms,server_cpu_pct,client_cpu_pct\nA,100,60,6001,0,0,0,0,40,35,20",
    ),
  ).toThrow(/reconcile/);
});

test("run evidence imports actual export structure, retains originals and persists notes", async ({
  page,
}) => {
  await page.goto("./chapters/06-differences-and-uncertainty.html");
  await page
    .getByText("Use real Chapter 2 measurements", { exact: true })
    .click();
  const exported = (id: string, duck: number) => ({
    format: "benchmarking-lab-databases-v1",
    startedAt: id,
    completedAt: "complete",
    settings: {
      rows: 2000,
      repeats: 2,
      sql: { lookup: "SELECT 1", revenue: "SELECT 2" },
    },
    build: "test",
    engines: {
      duckdb: { runtimeVersion: "1" },
      pglite: { runtimeVersion: "2" },
    },
    method: { ordering: "fresh" },
    fixture: { loadSqlSha256: "abc" },
    samples: [
      ...["lookup", "revenue"].flatMap((query) => [
        ...Array.from({ length: 2 }, () => ({
          engine: "duckdb",
          query,
          elapsedMs: duck,
          verified: true,
        })),
        ...Array.from({ length: 2 }, () => ({
          engine: "pglite",
          query,
          elapsedMs: 10,
          verified: true,
        })),
      ]),
    ],
  });
  await page.locator("#statistics-query").selectOption("revenue");
  await page.locator("#statistics-import").setInputFiles(
    [exported("one", 20), exported("two", 20)].map((data, i) => ({
      name: `run-${i}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    })),
  );
  await expect(page.locator("#statistics-status")).toContainText(
    "Imported 2 Chapter 2 exports for revenue",
  );
  await expect(page.locator("#statistics-output")).toContainText("2.00×");
  await page
    .locator("#statistics-notes")
    .fill("Same verified revenue job; repeat on another day.");
  const download = page.waitForEvent("download");
  await page.locator("#statistics-download").click();
  const artifact = await download;
  const stream = await artifact.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const evidence = JSON.parse(Buffer.concat(chunks).toString());
  expect(evidence.originals).toHaveLength(2);
  expect(evidence.analysis.n).toBe(2);
  await page.reload();
  await expect(page.locator("#statistics-notes")).toHaveValue(
    "Same verified revenue job; repeat on another day.",
  );
  await expect(page.locator("#statistics-input")).toHaveValue(
    "run,a_ms,b_ms\nrun-1,20,10\nrun-2,20,10",
  );
});

test("tail lab reveals pre-send waiting and keeps failures visible", async ({
  page,
}) => {
  await page.goto("./chapters/07-beyond-the-average.html");
  await expect(page.locator("#statistics-output")).toContainText(
    "p99 50.00 ms",
  );
  await page.locator("#statistics-boundary").selectOption("planned");
  await expect(page.locator("#statistics-output")).toContainText(
    "p99 350.00 ms",
  );
  await expect(page.locator("#statistics-output")).toContainText(
    "7 successful + 1 errors + 1 timeouts + 1 pending",
  );
  await expect(
    page.locator("#statistics-output .statistics-chart figcaption"),
  ).toHaveText("Successful request response times");
});

test("capacity lab refuses unreconciled evidence and shows failed rule", async ({
  page,
}) => {
  await page.goto("./chapters/08-demand-and-scaling.html");
  await expect(page.locator("#statistics-output")).toContainText(
    "A: highest supplied passing load 200/s",
  );
  await expect(page.locator("#statistics-output")).toContainText(
    "B: highest supplied passing load 100/s",
  );
  await page.locator("#statistics-target").fill("200");
  await page.locator("#statistics-analyse").click();
  await expect(page.locator("#statistics-output")).toContainText(
    "B: highest supplied passing load 100/s",
  );
  const input = page.locator("#statistics-input");
  await input.fill(
    (await input.inputValue()).replace("A,100,60,6000", "A,100,60,6001"),
  );
  await page.locator("#statistics-analyse").click();
  await expect(page.locator("#statistics-status")).toContainText(
    "Counts do not reconcile",
  );
  await expect(page.locator("#statistics-download")).toBeDisabled();
});

test("comparison charts keep readable labels and numeric values on narrow phones", async ({
  page,
}) => {
  const chapters = [
    "06-differences-and-uncertainty.html",
    "07-beyond-the-average.html",
    "08-demand-and-scaling.html",
  ];
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const chapter of chapters) {
      await page.goto(`./chapters/${chapter}`);
      const chart = page.locator(".statistics-chart");
      await expect(chart).toBeVisible();
      const measurements = await chart.evaluate((figure) => {
        const bounds = figure.getBoundingClientRect();
        return [
          ...figure.querySelectorAll<HTMLElement>(
            ".statistics-chart-label, .statistics-chart-value",
          ),
        ].map((label) => {
          const rect = label.getBoundingClientRect();
          return {
            text: label.textContent,
            fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
            left: rect.left,
            right: rect.right,
            chartLeft: bounds.left,
            chartRight: bounds.right,
            viewport: innerWidth,
          };
        });
      });
      expect(measurements.length).toBeGreaterThan(0);
      for (const label of measurements) {
        expect(label.text).toBeTruthy();
        expect(label.fontSize).toBeGreaterThanOrEqual(13);
        expect(label.left).toBeGreaterThanOrEqual(label.chartLeft - 1);
        expect(label.right).toBeLessThanOrEqual(label.chartRight + 1);
        expect(label.right).toBeLessThanOrEqual(label.viewport);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator("#statistics-output table")).toBeVisible();
    }
  }
});
