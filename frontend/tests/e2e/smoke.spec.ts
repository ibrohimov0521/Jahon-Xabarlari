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
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("header.site-header")).toBeVisible();
  await expect(page.locator(".news-card-modern").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${testInfo.project.name} overflowed by ${overflow}px`).toBeLessThanOrEqual(1);
});

test("a language supplied in a direct URL initializes the whole interface", async ({ page }) => {
  await page.goto("/?lang=en", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".language-trigger:visible, .mh-lang:visible")).toContainText("EN");
  await expect(page.locator("a.news-card-modern").first()).toHaveAttribute("href", /\?lang=en$/);
});

test("a directly opened article changes both interface and article language", async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL sozlanmagan");
  await page.context().addCookies([{ name: "lang", value: "uz", url: new URL(baseURL).origin }]);
  await page.goto("/articles/yer-sayyorasining-kelajagi", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Yer sayyorasining kelajagi");

  await page.locator(".language-trigger:visible, .mh-lang:visible").click();
  await page.getByRole("button", { name: /English/ }).click();

  await expect(page).toHaveURL(/\?lang=en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The future of planet Earth");
});

test("mobile navigation sheet opens, traps the visual layer and closes", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only interaction");
  await page.goto("/?lang=uz", { waitUntil: "networkidle" });
  const newsButton = page.locator('.bottom-nav button[aria-controls="mobile-navigation-sheet"]').first();
  await expect(newsButton).toBeVisible();
  await newsButton.click();
  await expect(page.getByRole("dialog", { name: /Bo'limlar|Yangiliklar/i })).toBeVisible();
  await page.getByRole("button", { name: "Yopish" }).last().click();
  await expect(page.locator("#mobile-navigation-sheet")).toHaveCount(0);
});

test("editorial trust pages are public", async ({ page }) => {
  await page.goto("/editorial-policy", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tahririyat siyosati" })).toBeVisible();
  await page.goto("/corrections", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tuzatishlar siyosati" })).toBeVisible();
});
