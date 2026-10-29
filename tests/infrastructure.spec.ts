import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const evidence = {
  schema: "benchmarking-lab-infrastructure-v1",
  mode: "broker",
  run_id: "example",
  summary: {
    offered: 2,
    expected_records: 2,
    received: 2,
    processed_unique: 1,
    verified_objects: null,
    missing: 1,
    extra: 0,
    wrong_values: 0,
    duplicate_receipts: 1,
    ordered_receipts: true,
    errors: 0,
    verification_polls: 0,
    verification_seconds: 0,
    elapsed_seconds: 3,
  },
  observations: [
    { t: 0, kind: "offered", object_id: 0 },
    { t: 0.5, kind: "offered", object_id: 1 },
    { t: 1, kind: "processed", object_id: 0, record_id: null },
    { t: 2, kind: "processed", object_id: 0, record_id: null },
  ],
};
for (const chapter of ["09-beyond-databases", "10-complete-pipeline"]) {
  test(`${chapter} validates, shows and retains imported evidence`, async ({
    page,
  }) => {
    await page.goto(`chapters/${chapter}.html`);
    await expect(page.locator("body")).toHaveClass(/lesson-page/);
    await expect(
      page.getByRole("link", {
        name: /Download the runnable infrastructure harness/,
      }),
    ).toHaveAttribute("href", "../harnesses/infrastructure.zip");
    await page.locator("#trace-json").fill(JSON.stringify(evidence));
    await page.getByRole("button", { name: "Inspect evidence" }).click();
    await expect(page.locator("#trace-result")).toContainText(
      "User-supplied trace",
    );
    await expect(page.locator("#trace-chart svg")).toBeVisible();
    await page.getByText("Show exact event observations").click();
    const rows = page.locator("#trace-chart tbody tr");
    await expect(rows.last()).toContainText("1");
    await expect(rows.last().locator("td").last()).toHaveText("1");
    await page
      .locator("#trace-notes")
      .fill("Customer target is not yet established.");
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export evidence and notes" })
      .click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe("infrastructure-review.json");
    const exported = JSON.parse(
      await readFile((await download.path())!, "utf8"),
    );
    expect(exported.evidence).toEqual(evidence);
    expect(exported.notes).toBe("Customer target is not yet established.");
    await page.locator("#trace-json").fill("{}");
    await expect(
      page.getByRole("button", { name: "Export evidence and notes" }),
    ).toBeDisabled();
    await expect(page.locator("#trace-chart svg")).toHaveCount(0);
    await page.getByRole("button", { name: "Inspect evidence" }).click();
    await expect(page.locator("#trace-result")).toContainText("Cannot inspect");
    await page.reload();
    await expect(page.locator("#trace-notes")).toHaveValue(
      "Customer target is not yet established.",
    );
    await expect(page.locator("#trace-json")).toHaveValue("{}");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.locator("#trace-json").fill(JSON.stringify(evidence));
    await page.getByRole("button", { name: "Inspect evidence" }).click();
    await expect(page.locator("#trace-chart svg")).toBeVisible();
    await page.locator("#trace-file").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schema":42}'),
    });
    await expect(
      page.getByRole("button", { name: "Export evidence and notes" }),
    ).toBeDisabled();
    await expect(page.locator("#trace-result")).toContainText("Cannot inspect");
    await page.locator("#trace-example").click();
    await expect(page.locator("#trace-result")).toContainText(
      "Recorded local functional example",
    );
    await expect(page.locator("#trace-result")).toContainText("missing 0");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await expect
        .poll(() =>
          page
            .locator("#trace-chart svg")
            .evaluate(
              (svg: SVGSVGElement) =>
                Math.abs(svg.viewBox.baseVal.width - svg.clientWidth) < 1,
            ),
        )
        .toBe(true);
      expect(
        await page
          .locator("#trace-chart svg")
          .evaluate((svg: SVGSVGElement) => {
            const bounds = svg.getBoundingClientRect();
            return (
              Math.abs(svg.getScreenCTM()!.a - 1) < 0.01 &&
              [...svg.querySelectorAll("text")].every((text) => {
                const box = text.getBoundingClientRect();
                return (
                  parseFloat(getComputedStyle(text).fontSize) >= 13 &&
                  box.left >= bounds.left - 1 &&
                  box.right <= bounds.right + 1
                );
              })
            );
          }),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}
