import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

// akun bank kosong tanpa institusi: tidak ada templat, jadi unggahan selalu lewat langkah pemetaan
function createAccount(): { accountId: string; name: string } {
  const out = execFileSync("bash", ["-c", "set -a; . ./.env.local; set +a; npx tsx tests/e2e/helpers/import-csv-account.ts"], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").at(-1) ?? "{}") as { accountId: string; name: string };
}

function csvFor(token: string): Buffer {
  const lines = [
    "LAPORAN MUTASI REKENING;;;;",
    "Periode;01-09-2026 s/d 20-09-2026;;;",
    ";;;;",
    "Tanggal;Keterangan;Debit;Kredit;Saldo",
    `02-09-2026;Gaji ${token};;8.500.000,00;13.500.000,00`,
    `03-09-2026;Kopi ${token};25.000,00;;13.475.000,00`,
    `05-09-2026;Listrik ${token};350.000,00;;13.125.000,00`,
    `32-09-2026;Baris rusak ${token};10.000,00;;13.115.000,00`,
    ";Saldo Akhir;;;13.125.000,00",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8");
}

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("unggah CSV tanpa templat, petakan kolom, lalu lanjut ke tinjau", async ({ page }) => {
  // empat halaman dan satu route unggah; server dev mengompilasi masing-masing saat pertama dibuka
  test.setTimeout(90_000);
  const account = createAccount();
  const token = account.name.split(" ").at(-1)!;

  await test.step("dari halaman Akun lewat menu Impor mutasi", async () => {
    await page.goto("/akun?scope=me");
    const item = page.getByRole("menuitem", { name: "Impor mutasi" });
    // klik sebelum hidrasi selesai tidak membuka menu, jadi diulang sampai menu tampil
    await expect(async () => {
      if (!(await item.isVisible())) await page.getByRole("button", { name: `Aksi untuk ${account.name}` }).click();
      await expect(item).toBeVisible({ timeout: 2000 });
    }).toPass();
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/impor\\?akun=${account.accountId}`));
    await expect(page.getByRole("radio", { name: new RegExp(account.name) })).toBeChecked();
  });

  await test.step("unggah file", async () => {
    await page.getByRole("region", { name: "File mutasi" }).locator('input[type="file"]').setInputFiles({ name: "mutasi.csv", mimeType: "text/csv", buffer: csvFor(token) });
    await expect(page.getByText("mutasi.csv")).toBeVisible();
    await page.getByRole("button", { name: "Unggah", exact: true }).click();
    await expect(page).toHaveURL(/\/impor\/[0-9a-f-]+\/pemetaan$/, { timeout: 30_000 });
  });

  await test.step("pemetaan terdeteksi otomatis dengan pratinjau dan baris yang dilewati", async () => {
    await expect(page.getByRole("region", { name: "Isi file" }).getByText(`Gaji ${token}`)).toBeVisible();
    await expect(page.getByLabel("Kolom tanggal")).toContainText("Tanggal");
    await expect(page.getByLabel("Format tanggal")).toContainText("31-12-2026");
    await expect(page.getByLabel("Kolom debit (keluar)")).toContainText("Debit");
    await expect(page.getByLabel("Kolom kredit (masuk)")).toContainText("Kredit");
    await expect(page.getByText("3 baris terbaca · 2 baris dilewati")).toBeVisible();
    await expect(page.getByText('Baris 8: Tanggal "32-09-2026" tidak cocok dengan format DD-MM-YYYY')).toBeVisible();
    await expect(page.getByText("+Rp 8.500.000")).toBeVisible();
    await expect(page.getByText("−Rp 25.000")).toBeVisible();
  });

  await test.step("format tanggal bisa diubah (F-IN-4 AC3)", async () => {
    await page.getByLabel("Format tanggal").click();
    await page.getByRole("option", { name: /2026-12-31/ }).click();
    await expect(page.getByText(/Tidak ada baris yang terbaca dengan pemetaan ini/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Lanjut ke tinjau" })).toBeDisabled();
    await page.getByLabel("Format tanggal").click();
    await page.getByRole("option", { name: /31-12-2026/ }).click();
    await expect(page.getByText("3 baris terbaca · 2 baris dilewati")).toBeVisible();
  });

  await test.step("lanjut ke tinjau", async () => {
    await expect(page.getByText(/tanpa institusi, jadi pemetaan tidak bisa disimpan/)).toBeVisible();
    await page.getByRole("button", { name: "Lanjut ke tinjau" }).click();
    await expect(page).toHaveURL(/\/impor\/[0-9a-f-]+$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Baru (3)" })).toBeVisible();
  });
});

test("file bukan CSV atau PDF ditolak dengan pesan", async ({ page }) => {
  const account = createAccount();
  await page.goto(`/impor?akun=${account.accountId}`);
  await expect(page.getByRole("radio", { name: new RegExp(account.name) })).toBeChecked();
  await page.getByRole("region", { name: "File mutasi" }).locator('input[type="file"]').setInputFiles({ name: "mutasi.csv", mimeType: "text/csv", buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]) });
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
  await expect(page.getByText("File Excel belum bisa dibaca. Simpan sebagai CSV dari Excel lalu unggah lagi.")).toBeVisible();
});
