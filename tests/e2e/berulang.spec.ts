import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

function runRecurringJob(note: string): { created: number; drafts: number } {
  const out = execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; npx tsx tests/e2e/helpers/run-recurring.ts ${JSON.stringify(note)}`], {
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").at(-1) ?? "{}") as { created: number; drafts: number };
}

test("transaksi berulang: buat jadwal, job membuat draf, konfirmasi, hapus jadwal", async ({ page, context }) => {
  const note = `E2E Langganan ${Date.now().toString(36)}`;
  await loginAs(context);

  await page.goto("/transaksi");
  await page.getByRole("link", { name: "Transaksi berulang" }).click();
  await expect(page).toHaveURL(/\/transaksi\/berulang/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Transaksi berulang" })).toBeVisible();

  await page.getByRole("button", { name: "Tambah transaksi berulang" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Tambah transaksi berulang" });
  await sheet.getByLabel("Nama atau catatan").fill(note);
  await sheet.getByLabel("Nominal").fill("55rb");
  await sheet.getByRole("combobox", { name: "Kategori" }).click();
  await page.getByRole("option").first().click();
  await expect(sheet.getByText(/^Bulanan, tanggal \d+/)).toBeVisible();
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(sheet).toBeHidden({ timeout: 30_000 });

  const row = page.getByRole("listitem").filter({ hasText: note });
  await expect(row).toBeVisible();
  await expect(row).toContainText("−Rp 55.000");
  await expect(row).toContainText("hari ini");

  expect(runRecurringJob(note)).toMatchObject({ created: 1, drafts: 1 });
  await page.reload();
  await expect(row).toContainText("1 menunggu konfirmasi");
  await expect(row).not.toContainText("hari ini");

  await row.getByRole("link", { name: "1 menunggu konfirmasi" }).click();
  await expect(page).toHaveURL(/status=draft/);
  await page.getByRole("button", { name: `Konfirmasi ${note}` }).click();
  await expect(page.getByText("Dikonfirmasi", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: `Konfirmasi ${note}` })).toBeHidden();

  // job yang diulang di hari yang sama tidak membuat transaksi lagi
  expect(runRecurringJob(note)).toMatchObject({ created: 0 });

  await page.goto("/transaksi/berulang");
  await row.getByRole("button", { name: `Aksi untuk ${note}` }).click();
  await page.getByRole("menuitem", { name: "Hapus jadwal" }).click();
  const confirm = page.getByRole("dialog", { name: `Hapus jadwal ${note}?` });
  await confirm.getByRole("button", { name: "Hapus jadwal" }).click();
  await expect(confirm).toBeHidden({ timeout: 30_000 });
  await expect(row).toBeHidden();
});

test("jadikan berulang dari detail transaksi mengisi form", async ({ page, context }) => {
  await loginAs(context);
  await page.goto("/transaksi");
  const firstRow = page.getByRole("region", { name: "Daftar transaksi" }).getByRole("button").first();
  await firstRow.click();
  await page.getByRole("link", { name: "Jadikan berulang" }).click();
  await expect(page).toHaveURL(/\/transaksi\/berulang\?dari=/);
  const sheet = page.getByRole("dialog", { name: "Tambah transaksi berulang" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Nominal")).not.toHaveValue("");
  await sheet.getByRole("button", { name: "Batal" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/transaksi\/berulang$/);
});
