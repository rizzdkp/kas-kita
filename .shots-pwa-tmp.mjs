import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const SP = process.argv[2];
const cookie = JSON.parse(readFileSync(`${SP}/cookie.json`, "utf8"));
const BASE = "http://localhost:3704";
const browser = await chromium.launch();
async function ctx(opts) {
  const c = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Jakarta", ...opts });
  await c.addCookies([{ name: cookie.name, value: cookie.value, domain: "localhost", path: "/" }]);
  return c;
}
// G1 vs G2: quick-add bar crop, di atas konten yang di-scroll
for (const scheme of ["light", "dark"]) {
  for (const [name, motion] of [["g1", "reduce"], ["g2", "no-preference"]]) {
    const c = await ctx({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: motion });
    const p = await c.newPage();
    await p.goto(`${BASE}/transaksi`);
    await p.waitForTimeout(2500);
    await p.locator("header:visible").first().screenshot({ path: `${SP}/${name}-toolbar-${scheme}.png` });
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(800);
    const lens = await p.getByRole("form", { name: "Catat transaksi" }).getAttribute("data-lens");
    console.log(scheme, name, "lens", lens);
    const box = await p.getByRole("form", { name: "Catat transaksi" }).boundingBox();
    await p.screenshot({ path: `${SP}/${name}-quickadd-${scheme}.png`, clip: { x: box.x - 40, y: box.y - 60, width: box.width + 80, height: box.height + 100 } });
    await c.close();
  }
}
// mobile tab bar G2
for (const [name, motion] of [["g1", "reduce"], ["g2", "no-preference"]]) {
  const c = await ctx({ viewport: { width: 390, height: 844 }, colorScheme: "light", reducedMotion: motion, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  await p.goto(`${BASE}/transaksi`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${SP}/${name}-mobile-bottom.png`, clip: { x: 0, y: 600, width: 390, height: 244 } });
  await c.close();
}
// offline page & settings
for (const scheme of ["light", "dark"]) {
  for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const c = await ctx({ viewport: size, colorScheme: scheme });
    const p = await c.newPage();
    await p.goto(`${BASE}/~offline`);
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${SP}/offline-${vp}-${scheme}.png` });
    await p.goto(`${BASE}/pengaturan#notifikasi`);
    await p.waitForTimeout(2500);
    await p.locator("#notifikasi").scrollIntoViewIfNeeded();
    await p.locator("#notifikasi").screenshot({ path: `${SP}/settings-push-${vp}-${scheme}.png` });
    await c.close();
  }
}
// dashboard offline with notice
{
  const c = await ctx({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  const p = await c.newPage();
  await p.goto(`${BASE}/`);
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.waitForTimeout(3000);
  await c.setOffline(true);
  await p.reload();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SP}/dashboard-offline-mobile.png` });
  await c.close();
}
await browser.close();
