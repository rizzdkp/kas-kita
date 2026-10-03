import { test } from "@playwright/test";
import { loginAs } from "./helpers/session";
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
test("debug", async ({ page, context }) => {
  await loginAs(context);
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForTimeout(3000);
  console.log("controller", await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
  console.log("caches", await page.evaluate(async () => { const out: Record<string,string[]> = {}; for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map(r=>r.url).filter(u=>!u.includes("_next")); return out; }));
  await context.setOffline(true);
  console.log("fetch", await page.evaluate(() => fetch("/api/health").then(r=>r.status).catch(e=>String(e))));
  await page.reload();
  await page.waitForTimeout(2000);
  console.log("after reload caches", await page.evaluate(async () => (await (await caches.open("kaskita-pages")).keys()).map(r=>r.url)));
  const res = await page.goto("/laporan");
  console.log("goto", res?.status(), res?.fromServiceWorker(), await page.title());
});
