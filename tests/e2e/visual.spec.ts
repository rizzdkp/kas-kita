import { expect, test, type Page } from "@playwright/test";
import { SESSION_COOKIE_NAMES } from "@/server/auth/constants";
import { TRANSPARENCY_KEY } from "@/styles/preferences";

// snapshot visual glass (AGENTS.md: terang, gelap, dan reduced transparency) untuk galeri dan shell

type Variant = { name: string; colorScheme: "light" | "dark"; reducedTransparency: boolean };

const VARIANTS: Variant[] = [
  { name: "terang", colorScheme: "light", reducedTransparency: false },
  { name: "gelap", colorScheme: "dark", reducedTransparency: false },
  { name: "terang-g0", colorScheme: "light", reducedTransparency: true },
  { name: "gelap-g0", colorScheme: "dark", reducedTransparency: true },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function prepare(page: Page, variant: Variant, baseURL: string | undefined) {
  // middleware hanya memeriksa keberadaan cookie; shell M0 memakai data contoh
  await page.context().addCookies([{ name: SESSION_COOKIE_NAMES[0], value: "visual-test", url: baseURL ?? "http://localhost:3000" }]);
  await page.emulateMedia({ colorScheme: variant.colorScheme, reducedMotion: "reduce" });
  if (variant.reducedTransparency) {
    await page.addInitScript((key) => window.localStorage.setItem(key, "reduced"), TRANSPARENCY_KEY);
  }
}

// indikator dev Next.js hanya ada di `next dev`; ditutup supaya snapshot sama di dev dan build
const devOverlay = (page: Page) => [page.locator("nextjs-portal")];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

for (const viewport of VIEWPORTS) {
  for (const variant of VARIANTS) {
    test.describe(`${viewport.name} ${variant.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("shell", async ({ page, baseURL }) => {
        await prepare(page, variant, baseURL);
        await page.goto("/?scope=all");
        await settle(page);
        const glass = page.locator(".glass").first();
        const filter = await glass.evaluate((el) => getComputedStyle(el).backdropFilter);
        if (variant.reducedTransparency) expect(filter).toBe("none");
        else expect(filter).toContain("blur");
        await expect(page).toHaveScreenshot(`shell-${viewport.name}-${variant.name}.png`, { mask: devOverlay(page) });
      });

      test("galeri komponen", async ({ page, baseURL }) => {
        await prepare(page, variant, baseURL);
        await page.goto("/dev/komponen");
        await settle(page);
        await expect(page).toHaveScreenshot(`galeri-${viewport.name}-${variant.name}.png`, { fullPage: true, mask: devOverlay(page) });
      });
    });
  }
}

test("toggle cakupan menulis ?scope= dan bisa dipakai dengan panah", async ({ page, baseURL }) => {
  await prepare(page, VARIANTS[0]!, baseURL);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "Cakupan" }).locator("visible=true");
  await group.getByRole("radio", { name: "Saya" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/scope=partner/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/scope=all/);
});
