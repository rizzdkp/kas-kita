import { expect, test, type Page } from "@playwright/test";
import { TRANSPARENCY_KEY } from "@/styles/preferences";
import { loginAs } from "./helpers/session";

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

async function prepare(page: Page, variant: Variant) {
  // layout memanggil requireViewer, jadi perlu sesi asli user seed
  await loginAs(page.context());
  await page.emulateMedia({ colorScheme: variant.colorScheme, reducedMotion: "reduce" });
  if (variant.reducedTransparency) {
    await page.addInitScript((key) => window.localStorage.setItem(key, "reduced"), TRANSPARENCY_KEY);
  }
}

// indikator dev Next.js hanya ada di `next dev`; ditutup supaya snapshot sama di dev dan build
const devOverlay = (page: Page) => [page.locator("nextjs-portal")];

// shell memotret kerangka saja: isi halaman (angka, tanggal relatif) disembunyikan, titik notifikasi ditutup
const HIDE_CONTENT = "#konten > :last-child { visibility: hidden !important; }";
const shellMask = (page: Page) => [
  ...devOverlay(page),
  page.getByRole("button", { name: /^Notifikasi/ }),
  page.getByRole("button", { name: /^Menu akun/ }),
];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

for (const viewport of VIEWPORTS) {
  for (const variant of VARIANTS) {
    test.describe(`${viewport.name} ${variant.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("shell", async ({ page }) => {
        await prepare(page, variant);
        await page.goto("/?scope=all");
        await settle(page);
        const glass = page.locator(".glass").first();
        const filter = await glass.evaluate((el) => getComputedStyle(el).backdropFilter);
        if (variant.reducedTransparency) expect(filter).toBe("none");
        else expect(filter).toContain("blur");
        await page.addStyleTag({ content: HIDE_CONTENT });
        await expect(page).toHaveScreenshot(`shell-${viewport.name}-${variant.name}.png`, { mask: shellMask(page) });
      });

      test("galeri komponen", async ({ page }) => {
        await prepare(page, variant);
        const res = await page.goto("/dev/komponen");
        expect(res?.status(), "build produksi: jalankan server dengan KASKITA_DEV_PAGES=1").toBe(200);
        await settle(page);
        await expect(page).toHaveScreenshot(`galeri-${viewport.name}-${variant.name}.png`, { fullPage: true, mask: devOverlay(page) });
      });
    });
  }
}

test("toggle cakupan menulis ?scope= dan bisa dipakai dengan panah", async ({ page }) => {
  await prepare(page, VARIANTS[0]!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "Cakupan" }).locator("visible=true");
  await group.getByRole("radio", { name: "Saya" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/scope=partner/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/scope=all/);
});
