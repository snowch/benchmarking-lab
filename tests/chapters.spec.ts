// Copyright © 2026 Christopher Snow
import { test, expect } from "@playwright/test";

test("the complete reading path opens and reloads without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/benchmarking-lab/");
  await page.getByText("Book contents", { exact: true }).click();
  const links = await page
    .locator('nav[aria-label="Book chapters"] a')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        href: (node as HTMLAnchorElement).href,
        text: node.textContent,
      })),
    );
  expect(links).toHaveLength(12);
  for (let i = 1; i < links.length; i++) {
    const response = await page.goto(links[i].href);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main > .notice")).toContainText(
      "chapter outline",
    );
    await expect(page.locator("#practice")).toContainText(
      "Start your benchmark brief",
    );
    await expect(
      page.locator('nav[aria-label="Book chapters"] [aria-current="page"]'),
    ).toHaveAttribute(
      "href",
      new URL(links[i].href).pathname.split("/").pop()!,
    );
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute(
      "href",
      i === 1 ? "../" : new URL(links[i - 1].href).pathname.split("/").pop()!,
    );
    if (i < 11)
      await expect(page.locator('a[rel="next"]')).toHaveAttribute(
        "href",
        new URL(links[i + 1].href).pathname.split("/").pop()!,
      );
    await page.reload();
    await expect(page.locator("h1")).not.toBeEmpty();
  }
  await page.locator("nav.chapter-pagination a").last().click();
  await expect(page.locator("#run")).toBeDisabled();
  await context.close();
});

test("outlines work on phones with shared theme and no benchmark loading", async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./chapters/10-complete-pipeline.html");
  await expect(page.locator(".book-contents")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.getByText("Book contents", { exact: true }).click();
  await page
    .locator(
      'nav[aria-label="Book chapters"] a[href="11-capacity-and-cost.html"]',
    )
    .click();
  await expect(page.locator("h1")).toHaveText(
    "From benchmark results to capacity and cost",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.locator("main").getByRole("link", { name: "Read Sizing and TCO" }),
  ).toHaveAttribute("href", "https://snowch.github.io/sizing-and-tco/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(requests.some((url) => /worker-|wabt|\.wasm/.test(url))).toBe(false);
  expect(errors).toEqual([]);
});

test("the working chapter links forward and keeps its lab usable", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator('a[rel="next"]').click();
  await expect(page.locator("h1")).toHaveText("DuckDB or Postgres?");
  await page.locator('a[rel="prev"]').click();
  await expect(page.locator("#run")).toBeEnabled();
  await expect(page.locator("#source")).not.toHaveValue("");
});
