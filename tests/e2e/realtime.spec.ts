import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

// ARCHITECTURE 8: simpanan Rizz muncul di layar Nadia tanpa muat ulang (SSE + router.refresh)

const tags: string[] = [];

function psql(query: string): string {
  return execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; psql "$DATABASE_URL" -At -c ${JSON.stringify(query)}`], {
    encoding: "utf8",
  }).trim();
}

test.afterAll(() => {
  for (const t of tags) {
    psql(`update transactions set deleted_at = now() where source = 'quick_add' and note ilike '%${t}%' and deleted_at is null`);
  }
});

test("transaksi baru Rizz tampil di Transaksi Nadia dalam 5 detik", async ({ browser }) => {
  test.setTimeout(180_000);
  // hanya huruf supaya parser tidak membaca penanda sebagai nominal
  const tag = `realtime${Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("")}`;
  tags.push(tag);

  const nadiaContext = await browser.newContext();
  await loginAs(nadiaContext, "nadia@kaskita.local");
  const nadia = await nadiaContext.newPage();
  const sse = nadia.waitForResponse((r) => r.url().endsWith("/api/events"), { timeout: 60_000 });
  await nadia.goto("/transaksi?scope=all");
  await expect(nadia.getByRole("textbox", { name: "Catat transaksi" })).toBeVisible({ timeout: 60_000 });
  expect((await sse).status()).toBe(200);

  const rizzContext = await browser.newContext();
  await loginAs(rizzContext);
  const rizz = await rizzContext.newPage();
  await rizz.goto("/");
  const bar = rizz.getByRole("textbox", { name: "Catat transaksi" });
  await expect(bar).toBeVisible({ timeout: 60_000 });
  await bar.fill(`kopi ${tag} 25rb gopay`);
  await bar.press("Enter");
  const card = rizz.getByTestId("quick-add-card");
  await expect(card).toHaveCount(1);
  await expect(rizz.getByRole("button", { name: "Simpan", exact: true })).toBeFocused();
  await rizz.keyboard.press("Enter");
  await expect(rizz.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible({ timeout: 20_000 });

  // tanpa goto/reload di halaman Nadia
  await expect(nadia.getByText(new RegExp(tag, "i")).first()).toBeVisible({ timeout: 5_000 });

  await rizzContext.close();
  await nadiaContext.close();
});
