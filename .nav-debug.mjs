import { chromium, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
const base = process.env.BASE ?? "http://localhost:3400";
const path = process.env.P ?? "/laporan?bulan=2026-08";
const out = execFileSync("bash", ["-c", "set -a; . ./.env.local; set +a; npx tsx scripts/dev-session.ts rizz@kaskita.local"], { encoding: "utf8" });
const c = JSON.parse(out.trim().split("\n").at(-1));
const b = await chromium.launch();
for (let i = 0; i < 3; i++) {
const ctx = await b.newContext({ ...devices["Desktop Chrome"], locale: "id-ID", timezoneId: "Asia/Jakarta" });
await ctx.addCookies([{ name: c.name, value: c.value, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.addInitScript(() => {
  const ab = AbortController.prototype.abort; AbortController.prototype.abort = function (...a) { console.warn("ABORT", performance.now()|0, new Error().stack); return ab.apply(this, a); }; window.addEventListener("pagehide", () => console.warn("PAGEHIDE"), true); window.addEventListener("beforeunload", () => console.warn("BEFOREUNLOAD"), true); navigation.addEventListener("navigate", (e) => console.warn("NAVIGATE", performance.now()|0, e.navigationType, e.destination.url, e.destination.sameDocument, e.userInitiated)); navigation.addEventListener("navigateerror", (e) => console.warn("NAVERR", e.message)); window.__raf = 0; window.__mut = 0; window.__ro = 0;
  const r = window.requestAnimationFrame; window.requestAnimationFrame = (f) => { window.__raf++; return r(f); };
  new MutationObserver((l) => { window.__mut += l.length; }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
});
page.on("request", (r) => { if (r.url().includes("_rsc") && !r.headers()["next-router-prefetch"]) console.log("navfetch", r.url()); }); page.on("requestfailed", (r) => { if (r.url().includes("_rsc") && !r.headers()["next-router-prefetch"]) console.log("navfetch FAIL", r.failure()?.errorText); });
page.on("console", (m) => { if (m.type() !== "log") console.log("console", m.type(), m.text().slice(0, 300)); });
await page.goto(base + path);
await page.getByRole("link", { name: new RegExp(process.env.LINK ?? "^Bulan sebelumnya") }).first().click();
await page.waitForTimeout(3000);
const a = await page.evaluate(() => [window.__raf, window.__mut]);
await page.waitForTimeout(2000);
const z = await page.evaluate(() => [window.__raf, window.__mut]);
console.log(i, page.url(), "raf/2s", z[0]-a[0], "mut/2s", z[1]-a[1]);
await ctx.close();
}
await b.close();
