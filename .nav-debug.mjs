import { chromium, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
const base = process.env.BASE ?? "http://localhost:3400";
const path = process.env.P ?? "/laporan?bulan=2026-08";
const out = execFileSync("bash", ["-c", "set -a; . ./.env.local; set +a; npx tsx scripts/dev-session.ts rizz@kaskita.local"], { encoding: "utf8" });
const c = JSON.parse(out.trim().split("\n").at(-1));
const b = await chromium.launch();
for (let i = 0; i < 4; i++) {
const ctx = await b.newContext({ ...devices["Desktop Chrome"], locale: "id-ID", timezoneId: "Asia/Jakarta" });
await ctx.addCookies([{ name: c.name, value: c.value, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__commits = [];
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(), supportsFiber: true, isDisabled: false,
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    onCommitFiberRoot(id, root) { window.__root = root; window.__commits.push(performance.now() | 0); },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {}, onScheduleFiberRoot() {},
  };
});
await page.route(/chunks\/9271-.*\.js/, async (route) => { const res = await route.fetch(); let body = await res.text(); body = body.replace("let r={then:()=>{}};", "let r={then:()=>{console.warn('UNRESOLVED', new Error().stack)}};"); body = body.replace("let o=r.payload,a=t.action(u,o);function i(e){r.discarded||", "let o=r.payload;console.warn('RUN', performance.now()|0, o.type, String(o.url||''), 'pending?', !!t.pending);let a=t.action(u,o);function i(e){console.warn('DONE', performance.now()|0, o.type, 'discarded', !!r.discarded);r.discarded||"); await route.fulfill({ response: res, body }); });
page.on("console", (m) => { if (m.type() === "warning") console.log("  ", m.text().slice(0, 1500)); });
await page.route(/chunks\/43ea4ca4-.*\.js/, async (route) => { const res = await route.fetch(); let body = await res.text(); body = body.replace("function iO(e,n,t){var r=e.pingCache;", "function iO(e,n,t){(window.__wk=window.__wk||[]).push({w:n,t:performance.now()|0,lanes:t,stack:new Error().stack});var r=e.pingCache;"); await route.fulfill({ response: res, body }); });
await page.goto(base + path);
const t = await page.evaluate(() => performance.now() | 0);
await page.getByRole("link", { name: new RegExp(process.env.LINK ?? "^Bulan sebelumnya") }).first().click();
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const r = window.__root;
  const wk = (window.__wk||[]).slice(-3).map((x) => ({ t: x.t, lanes: x.lanes.toString(2), status: x.w.status, ctor: x.w.constructor && x.w.constructor.name, keys: Object.keys(x.w).join(","), val: String(x.w.value).slice(0, 300), reason: String(x.w.reason).slice(0,300), stack: x.stack.split("\n").slice(1,4).join("|") }));
  
  const res = { commits: window.__commits, pending: r.pendingLanes.toString(2), suspended: r.suspendedLanes.toString(2), pinged: r.pingedLanes.toString(2), timeout: r.timeoutHandle, cancel: r.cancelPendingCommit === null ? "null" : String(r.cancelPendingCommit).slice(0,300) };
  return res;
});
console.log(i, page.url(), "click@", t, JSON.stringify(info));
await ctx.close();
}
await b.close();
