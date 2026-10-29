// Copyright © 2026 Christopher Snow
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  examplePlan,
  capacityResult,
  validatePlan,
  planGaps,
  emptyReport,
  validateReport,
  reportMarkdown,
  reportGaps,
} from "../src/decision-model";

test("capacity includes headroom, whole group reserve and complete cost categories", () => {
  const plan = examplePlan();
  const a = capacityResult(plan, plan.options[0]);
  const b = capacityResult(plan, plan.options[1]);
  expect(a.activeUnits).toBe(3);
  expect(a.units).toBe(4);
  expect(b.activeUnits).toBe(2);
  expect(b.units).toBe(3);
  expect(a.monthly.compute).toBe(1752);
  expect(a.monthly.storage).toBe(192);
  expect(a.total).toBe(35088);
  expect(b.total).toBe(39768);
  plan.options[0].rate = 600;
  expect(capacityResult(plan, plan.options[0]).total).toBe(40920);
  expect(planGaps(plan).join(" ")).toContain("unverified");
  expect(validatePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
});
test("capacity keeps failed and late output visible and rejects invalid imported inputs", () => {
  const plan = examplePlan();
  plan.options[0].correctPct = 90;
  plan.options[0].onTimePct = 50;
  const result = capacityResult(plan, plan.options[0]);
  expect(result.useful).toBeCloseTo(result.offered * 0.45);
  expect(result.incorrect).toBeCloseTo(result.offered * 0.1);
  expect(result.correctLate).toBeCloseTo(result.offered * 0.45);
  plan.options[0].correctPct = 0;
  expect(capacityResult(plan, plan.options[0]).perMillion).toBeNull();
  expect(() => validatePlan({ ...plan, average: plan.peak + 1 })).toThrow(
    /Average/,
  );
  expect(() => validatePlan({ ...plan, headroomPct: 100 })).toThrow(
    /headroomPct/,
  );
  expect(() => validatePlan({ ...plan, spare: 0.5 })).toThrow(/whole/);
  expect(() =>
    validatePlan({
      ...plan,
      options: [{ ...plan.options[0], rate: 0 }, plan.options[1]],
    }),
  ).toThrow(/Capacity/);
  expect(() =>
    validatePlan({ format: "benchmarking-lab-databases-v1" }),
  ).toThrow(/browser run/);
});
test("report exports missing evidence transparently and validates unique evidence IDs", () => {
  const report = emptyReport();
  report.attachments.push({
    id: "E1",
    name: "browser.json",
    source: "run snapshot",
    kind: "browser run",
    note: "Only tested browser aggregation",
    payload: { samples: [1] },
  });
  expect(reportGaps(report).join(" ")).toContain("server capacity");
  expect(reportMarkdown(report)).toContain("[Missing");
  expect(reportMarkdown(report)).toContain("E1: browser.json");
  expect(validateReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
  report.attachments.push({ ...report.attachments[0] });
  expect(() => validateReport(report)).toThrow(/unique/);
});
test("planner recalculates changed assumptions, persists, exports and rejects a browser record", async ({
  page,
}) => {
  await page.goto("chapters/11-capacity-and-cost.html");
  await expect(page.locator("#capacity-results")).toContainText("35,088");
  await page.locator("#capacity-0-rate").fill("600");
  await expect(page.locator("#capacity-results")).toContainText(
    "recalculation",
  );
  await page
    .getByRole("button", { name: "Calculate and save", exact: true })
    .click();
  await expect(page.locator("#capacity-results")).toContainText("40,920");
  await page.reload();
  await expect(page.locator("#capacity-0-rate")).toHaveValue("600");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plan JSON" }).click();
  const saved = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(saved.options[0].rate).toBe(600);
  await page.locator("#capacity-import").setInputFiles({
    name: "browser.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "benchmarking-lab-databases-v1" }),
    ),
  });
  await expect(page.locator("#capacity-status")).toContainText(
    "Import rejected",
  );
  await expect(page.locator("#capacity-0-rate")).toHaveValue("600");
  await page.locator("#capacity-common-average").fill("2000");
  await page
    .getByRole("button", { name: "Calculate and save", exact: true })
    .click();
  await expect(page.locator("#capacity-status")).toContainText(
    "Average demand cannot exceed",
  );
  await expect(page.locator("#capacity-results")).toContainText(
    "No current result",
  );
});
test("report retains original evidence safely, restores a project and exports readable limitations", async ({
  page,
}) => {
  await page.goto("chapters/12-defensible-comparison.html");
  await page
    .locator("#report-question")
    .fill("Choose an order dashboard implementation for the agreed workload.");
  await page.locator("#report-evidence").setInputFiles({
    name: "browser-evidence.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "benchmarking-lab-databases-v1",
        samples: [{ ms: 12 }],
        note: "<img src=x onerror=alert(1)>",
      }),
    ),
  });
  await expect(page.locator("#report-register")).toContainText("browser run");
  await expect(page.locator("#report-register img")).toHaveCount(0);
  await page
    .locator("#report-note-E1")
    .fill("E1 supports only this browser build; no server sizing claim.");
  await expect(page.locator("#report-checks")).toContainText(
    "cannot establish server capacity",
  );
  await page.reload();
  await expect(page.locator("#report-question")).toHaveValue(/order dashboard/);
  const downloading = page.waitForEvent("download");
  await page.locator("#report-download").click();
  const saved = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(saved.attachments[0].payload.samples[0].ms).toBe(12);
  expect(saved.attachments[0].source).toContain("SHA-256");
  await page.locator("#report-question").fill("temporary edit");
  await page.locator("#report-import").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.locator("#report-question")).toHaveValue(/order dashboard/);
  const markdown = page.waitForEvent("download");
  await page.locator("#report-markdown").click();
  const content = await readFile((await (await markdown).path())!, "utf8");
  expect(content).toContain("E1: browser-evidence.json");
  expect(content).toContain("Missing");
  await page.locator("#report-import").setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator("#report-status")).toContainText(
    "existing draft retained",
  );
  await expect(page.locator("#report-question")).toHaveValue(/order dashboard/);
});
