import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginAs } from "./helpers/session";

// tanpa ini permintaan dari service worker tidak bisa dicegat Playwright
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

// setOffline mengubah navigator.onLine, tapi fetch dari service worker setelah muat ulang tetap lolos; route memutus semuanya kecuali aset statis
async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
  await context.route(/^https?:\/\/[^/]+\/(?!_next\/static)/, (route) => route.abort("internetdisconnected"));
}

// service worker hanya dibangun di build produksi; di `next dev` spesifikasi ini dilewati
test.beforeEach(async ({ request }) => {
  const sw = await request.get("/sw.js");
  test.skip(!sw.ok(), "service worker tidak ada: jalankan terhadap next build + next start");
});

async function waitForControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
  });
}

async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const cache = await caches.open("kaskita-pages");
    return (await cache.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
  });
}

test("manifest lengkap untuk dipasang", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };
  expect(manifest).toMatchObject({ name: "Kas Kita", short_name: "Kas Kita", start_url: "/", display: "standalone" });
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  for (const [sizes, purpose] of [
    ["192x192", "any"],
    ["512x512", "any"],
    ["192x192", "maskable"],
    ["512x512", "maskable"],
  ]) {
    const icon = manifest.icons.find((i) => i.sizes === sizes && i.purpose === purpose);
    expect(icon, `${sizes} ${purpose}`).toBeDefined();
    expect((await request.get(icon!.src)).ok()).toBe(true);
  }
});

test("offline: Ringkasan menampilkan data terakhir, halaman yang belum dibuka menampilkan halaman offline", async ({ page, context }) => {
  await loginAs(context);
  await page.goto("/");
  await expect(page.getByTestId("hero-value")).toContainText("Rp");
  await waitForControl(page);
  // kunjungan pertama belum lewat service worker; klien meminta salinannya disimpan saat SW mengambil alih
  await expect.poll(() => cachedPaths(page), { timeout: 15_000 }).toContain("/");
  const heroOnline = await page.getByTestId("hero-value").textContent();

  await goOffline(context);
  await page.reload();
  await expect(page.getByTestId("hero-value")).toHaveText(heroOnline ?? "");
  await expect(page.getByRole("status").filter({ hasText: "Offline. Menampilkan data terakhir." })).toBeVisible();

  await page.goto("/laporan");
  await expect(page.getByRole("heading", { name: "Kamu sedang offline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Coba lagi" })).toBeVisible();

  await page.getByRole("button", { name: "Buka Ringkasan" }).click();
  await expect(page.getByTestId("hero-value")).toHaveText(heroOnline ?? "");
});

test("API dan lampiran tidak pernah disimpan service worker", async ({ page, context }) => {
  await loginAs(context);
  await page.goto("/");
  await waitForControl(page);
  await page.evaluate(() => fetch("/api/health").catch(() => null));
  const names = await page.evaluate(() => caches.keys());
  for (const name of names) {
    const paths = await page.evaluate(async (n) => (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname), name);
    expect(paths.filter((p) => p.startsWith("/api/")), name).toEqual([]);
  }
});
