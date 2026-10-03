import { expect, test, type Page } from "@playwright/test";
import { TRANSPARENCY_KEY } from "@/styles/preferences";
import { loginAs } from "./helpers/session";

// G2 hanya untuk Chromium (DESIGN 5.2); di WebKit lensa tidak boleh terpasang sama sekali
test.use({ viewport: { width: 1440, height: 900 } });

const quickAdd = (page: Page) => page.getByRole("form", { name: "Catat transaksi" });

async function lensState(page: Page) {
  return quickAdd(page).evaluate((el) => ({
    lens: el.getAttribute("data-lens"),
    backdrop: getComputedStyle(el).backdropFilter,
    filterId: /url\("?#([^")]+)"?\)/.exec(getComputedStyle(el).backdropFilter)?.[1] ?? null,
  }));
}

test.beforeEach(async ({ context, page }) => {
  await loginAs(context);
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

test("Chromium tanpa pengurangan transparansi: bar quick-add memakai filter SVG lensa", async ({ page, browserName }) => {
  await page.goto("/");
  if (browserName !== "chromium") {
    await expect.poll(async () => (await lensState(page)).lens).toBeNull();
    return;
  }
  await expect.poll(async () => (await lensState(page)).lens).toBe("on");
  const state = await lensState(page);
  expect(state.backdrop).toContain("url(");
  expect(state.backdrop).toContain("blur(");
  const filter = page.locator(`filter[id="${state.filterId}"]`);
  await expect(filter).toHaveAttribute("color-interpolation-filters", "sRGB");
  await expect(filter.locator("feDisplacementMap")).toHaveAttribute("scale", "18");
  await expect(filter.locator("feGaussianBlur")).toHaveAttribute("stdDeviation", "0.6");
  await expect(filter.locator("feImage")).toHaveAttribute("href", /^data:image\/png/);
  // toggle cakupan di toolbar juga dibungkus lensa
  await expect(page.locator("header [role=radiogroup][data-lens=on]")).toHaveCount(1);
});

test("Kurangi transparansi: tanpa lensa, glass solid", async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "reduced"), TRANSPARENCY_KEY);
  await page.goto("/");
  await expect(quickAdd(page)).toBeVisible();
  await page.waitForTimeout(300);
  const state = await lensState(page);
  expect(state.lens).toBeNull();
  expect(state.backdrop).toBe("none");
  await expect(page.locator("filter[id^=kk-lens]")).toHaveCount(0);
});

test("pengurangan gerak mematikan lensa, G1 tetap", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(quickAdd(page)).toBeVisible();
  await page.waitForTimeout(300);
  const state = await lensState(page);
  expect(state.lens).toBeNull();
  expect(state.backdrop).not.toContain("url(");
  expect(state.backdrop).toContain("blur(");
});

test("lensa ikut mati saat Kurangi transparansi dinyalakan tanpa muat ulang", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "G2 hanya Chromium");
  await page.goto("/");
  await expect.poll(async () => (await lensState(page)).lens).toBe("on");
  await page.evaluate(() => document.documentElement.setAttribute("data-transparency", "reduced"));
  await expect.poll(async () => (await lensState(page)).lens).toBeNull();
});
