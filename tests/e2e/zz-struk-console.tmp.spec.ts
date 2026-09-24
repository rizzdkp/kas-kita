import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";
test("console", async ({ page, context }) => {
  test.setTimeout(120_000);
  await loginAs(context);
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 600)); });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://localhost:3503/struk");
  await page.locator('main input[type="file"]').setInputFiles(join(process.cwd(), "tests/fixtures/receipts/indomaret.jpg"));
  await expect(page.getByLabel("Total struk")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1000);
});
