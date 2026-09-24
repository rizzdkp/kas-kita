import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

const OUT = "/tmp/claude-0/-home-user-kas-kita/9edd7bf2-cf92-5233-882d-176ca90c21b7/scratchpad/shots-struk";
const PHOTO = join(process.cwd(), "tests/fixtures/receipts/indomaret.jpg");
const sh = (c: string) => execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; ${c}`], { encoding: "utf8" }).trim();
let snap = "null";
const fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], { env: { ...process.env, FAKE_AI_PORT: "4013" }, stdio: "ignore" });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  snap = sh("npx tsx tests/e2e/helpers/struk-ai-settings.ts set http://localhost:4013/v1").split("\n").at(-1)!;
});
test.afterAll(() => {
  fake.kill();
  sh(`npx tsx tests/e2e/helpers/struk-ai-settings.ts restore '${snap}'`);
});
for (const scheme of ["light", "dark"] as const) {
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name} ${scheme}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport: vp, colorScheme: scheme, locale: "id-ID", timezoneId: "Asia/Jakarta" });
      await loginAs(context);
      const page = await context.newPage();
      await page.goto("http://localhost:3503/struk");
      await page.screenshot({ path: `${OUT}/pilih-${name}-${scheme}.png` });
      await page.locator('main input[type="file"]').setInputFiles(PHOTO);
      await expect(page.getByLabel("Total struk")).toHaveValue("168.000", { timeout: 60_000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/pratinjau-${name}-${scheme}.png`, fullPage: true });
      await page.getByLabel("Total struk").fill("192.000");
      await page.getByRole("radio", { name: /Simpan sebagai satu/ }).click();
      await page.screenshot({ path: `${OUT}/pratinjau-selisih-${name}-${scheme}.png` });
      await context.close();
    });
  }
}
