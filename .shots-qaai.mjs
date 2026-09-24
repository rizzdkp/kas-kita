import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
const OUT = process.argv[2];
const round = process.argv[3] ?? "r1";
const line = execFileSync("bash", ["-c", "set -a; . ./.env.local; set +a; npx tsx scripts/dev-session.ts"], { encoding: "utf8" }).trim().split("\n").at(-1);
const c = JSON.parse(line);
const browser = await chromium.launch();
const LINES = ["E2E servis motor 350rb", "E2E iuran sampah dan keamanan seratus ribu dari rekening bersama"];
for (const [vw, vh, dev] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Jakarta", viewport: { width: vw, height: vh }, colorScheme: scheme, deviceScaleFactor: dev === "mobile" ? 2 : 1 });
    await ctx.addCookies([{ name: c.name, value: c.value, domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    let hold = true;
    await page.route("**/*", async (route) => {
      const r = route.request();
      const body = r.method() === "POST" && r.headers()["next-action"] ? (r.postData() ?? "") : "";
      if (hold && body.includes("E2E ") && !body.includes("clientId")) { hold = false; await new Promise((x) => setTimeout(x, 2500)); }
      await route.continue().catch(() => {});
    });
    await page.goto("http://localhost:3502/", { timeout: 120000 });
    const box = page.getByRole("textbox", { name: "Catat transaksi" });
    await box.waitFor({ timeout: 120000 });
    await box.click();
    await page.keyboard.type(LINES[0]); await page.keyboard.press("Shift+Enter"); await page.keyboard.type(LINES[1]);
    await page.keyboard.press("Enter");
    await page.getByTestId("quick-add-ai-status").waitFor();
    await page.screenshot({ path: `${OUT}/${round}-${dev}-${scheme}-busy.png` });
    await page.getByTestId("quick-add-card").nth(1).waitFor({ timeout: 20000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${round}-${dev}-${scheme}-cards.png` });
    await ctx.close();
  }
}
await browser.close();
