// Copyright © 2026 Christopher Snow
import { test, expect } from "@playwright/test";

const prefix = "benchmarking-lab:v1:lesson-complete:";
const done = "Mark lesson as done";

test("every page can be marked, retained across navigation and undone, including the last chapter", async ({
  page,
}) => {
  await page.goto("chapters/start-here.html");
  const links = await page
    .locator('nav[aria-label="Book chapters"] a')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).href),
    );
  expect(links).toHaveLength(13);
  for (const href of links) {
    await page.goto(href);
    const checkbox = page.getByRole("checkbox", { name: done });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(page.locator('aside [aria-current="page"]')).toHaveAttribute(
      "data-complete",
      "true",
    );
    await expect(
      page.locator('aside [aria-current="page"]'),
    ).toHaveAccessibleName(/Completed/);
  }
  await page.reload();
  await expect(page.getByRole("checkbox", { name: done })).toBeChecked();
  await expect(
    page.locator(".chapter-complete-mark:not([hidden])"),
  ).toHaveCount(13);
  await page.getByRole("checkbox", { name: done }).uncheck();
  await expect(
    page.locator(".chapter-complete-mark:not([hidden])"),
  ).toHaveCount(12);
  await expect(
    page.locator('aside [aria-current="page"]'),
  ).not.toHaveAccessibleName(/Completed/);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: done })).not.toBeChecked();
});

test("keyboard marks survive next/back navigation and leave saved lab work untouched", async ({
  page,
}) => {
  await page.goto("./");
  const draft = JSON.stringify({ n: "64", notes: "Keep my observations." });
  await page.evaluate(
    (value) => localStorage.setItem("benchmarking-lab:chapter-01:v1", value),
    draft,
  );
  await page.reload();
  await expect(page.locator("#notes")).toHaveValue("Keep my observations.");
  const checkbox = page.getByRole("checkbox", { name: done });
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("benchmarking-lab:chapter-01:v1"),
    ),
  ).toBe(draft);
  await page.locator('a[rel="next"]').click();
  await expect(page.getByRole("checkbox", { name: done })).not.toBeChecked();
  await expect(page.locator('aside a[href="../"]')).toHaveAttribute(
    "data-complete",
    "true",
  );
  await page.locator('a[rel="prev"]').click();
  await expect(checkbox).toBeChecked();
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeFocused();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("benchmarking-lab:chapter-01:v1"),
    ),
  ).toBe(draft);
});

test("tabs update each other without overwriting marks for different lessons", async ({
  context,
}) => {
  const first = await context.newPage(),
    second = await context.newPage();
  await first.goto("./");
  await second.goto("chapters/02-duckdb-postgres.html");
  await first.getByRole("checkbox", { name: done }).check();
  await expect(second.locator('aside a[href="../"]')).toHaveAttribute(
    "data-complete",
    "true",
  );
  await second.getByRole("checkbox", { name: done }).check();
  await expect(
    first.locator('aside a[href="./chapters/02-duckdb-postgres.html"]'),
  ).toHaveAttribute("data-complete", "true");
  await expect(first.getByRole("checkbox", { name: done })).toBeChecked();
  await first.reload();
  await expect(
    first.locator(".chapter-complete-mark:not([hidden])"),
  ).toHaveCount(2);
  await second.getByRole("checkbox", { name: done }).uncheck();
  await expect(
    first.locator(".chapter-complete-mark:not([hidden])"),
  ).toHaveCount(1);
  await second.evaluate(() => localStorage.clear());
  await expect(first.getByRole("checkbox", { name: done })).not.toBeChecked();
  await expect(
    first.locator(".chapter-complete-mark:not([hidden])"),
  ).toHaveCount(0);
});

test("a failed write keeps the explicit choice and reports that it was not saved", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((keyPrefix) => {
    const write = Storage.prototype.setItem;
    write.call(localStorage, keyPrefix + "01", "true");
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith(keyPrefix))
        throw new DOMException("Storage quota", "QuotaExceededError");
      write.call(this, key, value);
    };
  }, prefix);
  await page.goto("./");
  const checkbox = page.getByRole("checkbox", { name: done });
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator('aside [aria-current="page"]')).toHaveAttribute(
    "data-complete",
    "false",
  );
  await expect(page.locator("#lesson-progress-note")).toContainText(
    "could not be saved",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), prefix + "01"),
  ).toBe("true");
  await checkbox.check();
  await expect(page.locator("#lesson-progress-note")).toContainText(
    "only available on this page",
  );
  expect(errors).toEqual([]);
});

test("completion fits narrow screens and the reading path remains usable without JavaScript", async ({
  page,
  browser,
}) => {
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("chapters/12-defensible-comparison.html");
    await page.getByRole("checkbox", { name: done }).check();
    await expect(page.locator(".lesson-progress")).toBeVisible();
    const bounds = await page.locator(".lesson-progress label").boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width <= 750) await page.getByText("Chapters", { exact: true }).click();
    await expect(
      page.locator('aside [aria-current="page"] .chapter-complete-mark'),
    ).not.toHaveAttribute("hidden");
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 960 },
  });
  const reading = await context.newPage();
  await reading.goto(
    "http://127.0.0.1:4173/benchmarking-lab/chapters/start-here.html",
  );
  await expect(reading.locator(".lesson-progress")).toBeHidden();
  await expect(reading.locator("#lesson-done")).toBeDisabled();
  await reading.locator('a[rel="next"]').click();
  await expect(reading.locator("h1")).toContainText("Same work");
  await context.close();
});
