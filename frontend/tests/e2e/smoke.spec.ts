import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/rates", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ updated: "17.07.2026", base: "UZS", rates: [] })
    })
  );
});

test("homepage renders usable news content without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("header.site-header")).toBeVisible();
  await expect(page.locator(".news-card-modern").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${testInfo.project.name} overflowed by ${overflow}px`).toBeLessThanOrEqual(1);
});

test("mobile navigation sheet opens, traps the visual layer and closes", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only interaction");
  await page.goto("/?lang=uz");
  const newsButton = page.getByRole("button", { name: /Yangiliklar/i });
  await newsButton.click();
  await expect(page.getByRole("dialog", { name: /Bo'limlar|Yangiliklar/i })).toBeVisible();
  await page.getByRole("button", { name: "Yopish" }).last().click();
  await expect(page.locator("#mobile-navigation-sheet")).toHaveCount(0);
});

test("editorial trust pages are public", async ({ page }) => {
  await page.goto("/editorial-policy");
  await expect(page.getByRole("heading", { name: "Tahririyat siyosati" })).toBeVisible();
  await page.goto("/corrections");
  await expect(page.getByRole("heading", { name: "Tuzatishlar siyosati" })).toBeVisible();
});
