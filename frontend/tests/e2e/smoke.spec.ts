import { expect, test } from "@playwright/test";

async function scrollPageForLockTest(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.min(420, Math.max(0, document.documentElement.scrollHeight - innerHeight)));
    document.documentElement.style.scrollBehavior = previous;
    return window.scrollY;
  });
}

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

test("article comments expose an accessible composer", async ({ page }) => {
  await page.goto("/articles/yer-sayyorasining-kelajagi?lang=uz", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Izohlar/ }).click();

  const dialog = page.getByRole("dialog", { name: "Izohlar" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Izoh yozish" })).toBeVisible();
  await dialog.getByRole("button", { name: "Izoh yozish" }).click();
  await expect(dialog.getByRole("textbox", { name: "Ismingiz" })).toBeFocused();
  await expect(dialog.getByRole("textbox", { name: "Izoh yozing..." })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Yuborish" })).toBeVisible();
});

test("mobile navigation sheet opens, traps the visual layer and closes", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only interaction");
  await page.goto("/?lang=uz", { waitUntil: "networkidle" });
  await scrollPageForLockTest(page);
  const newsButton = page.locator('.bottom-nav button[aria-controls="mobile-navigation-sheet"]').first();
  await expect(newsButton).toBeVisible();
  await newsButton.click();
  const sheet = page.getByRole("dialog", { name: /Bo'limlar|Yangiliklar/i });
  await expect(sheet).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  const lockedScroll = await page.evaluate(() => Math.abs(Number.parseFloat(document.body.style.top) || 0));
  await sheet.hover();
  await page.mouse.wheel(0, 5_000);
  expect(await page.evaluate(() => Math.abs(Number.parseFloat(document.body.style.top) || 0))).toBe(lockedScroll);
  await page.getByRole("button", { name: "Yopish" }).last().click();
  await expect(page.locator("#mobile-navigation-sheet")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - lockedScroll)).toBeLessThanOrEqual(1);
});

test("desktop more menu locks background scrolling and closes outside", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "desktop-only interaction");
  await page.goto("/?lang=uz", { waitUntil: "networkidle" });
  await scrollPageForLockTest(page);
  await page.getByRole("button", { name: /Ko'proq/i }).click();
  await expect(page.locator(".desktop-more-overlay")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  const lockedScroll = await page.evaluate(() => Math.abs(Number.parseFloat(document.body.style.top) || 0));
  await page.mouse.wheel(0, 5_000);
  expect(await page.evaluate(() => Math.abs(Number.parseFloat(document.body.style.top) || 0))).toBe(lockedScroll);
  await page.locator(".desktop-more-overlay").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".desktop-more-overlay")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - lockedScroll)).toBeLessThanOrEqual(1);
});

test("editorial trust pages are public", async ({ page }) => {
  await page.goto("/editorial-policy", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tahririyat siyosati" })).toBeVisible();
  await page.goto("/corrections", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tuzatishlar siyosati" })).toBeVisible();
});
