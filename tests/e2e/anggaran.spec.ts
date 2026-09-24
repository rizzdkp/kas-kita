import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

// bulan jauh di depan supaya tidak mengganggu anggaran berjalan di data contoh
const MONTH = "2027-03";

test("buat anggaran wajib di bulan kosong, ubah nominalnya, lalu hapus", async ({ page }) => {
  await page.goto(`/anggaran?bulan=${MONTH}`);
  await expect(page.getByRole("heading", { name: "Maret 2027" })).toBeVisible();

  await test.step("state kosong lalu buat anggaran", async () => {
    await expect(page.getByRole("heading", { name: "Belum ada anggaran di bulan ini" })).toBeVisible();
    await page.getByRole("button", { name: "Buat anggaran" }).click();
    const sheet = page.getByRole("dialog", { name: "Tambah anggaran" });
    await sheet.getByRole("combobox", { name: "Kategori pengeluaran" }).click();
    await page.getByRole("option", { name: "Hiburan", exact: true }).click();
    await sheet.getByLabel("Nominal per bulan").fill("750rb");
    await sheet.getByRole("radio", { name: "Wajib" }).click();
    await sheet.getByRole("button", { name: "Simpan" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible();
  });

  const row = page.getByRole("button", { name: "Ubah anggaran Hiburan" });
  await test.step("baris menampilkan terpakai, anggaran, jenis, dan status", async () => {
    await expect(row).toContainText("Rp 750.000");
    await expect(row).toContainText("Wajib");
    await expect(row).toContainText("Sesuai");
  });

  await test.step("ubah nominal", async () => {
    await row.click();
    const sheet = page.getByRole("dialog", { name: "Ubah anggaran Hiburan" });
    await sheet.getByLabel("Nominal per bulan").fill("1jt");
    await sheet.getByRole("button", { name: "Simpan" }).click();
    await expect(sheet).toBeHidden();
    await expect(row).toContainText("Rp 1.000.000");
  });

  await test.step("hapus", async () => {
    await row.click();
    await page.getByRole("dialog", { name: "Ubah anggaran Hiburan" }).getByRole("button", { name: "Hapus anggaran" }).click();
    const confirm = page.getByRole("dialog", { name: "Hapus anggaran Hiburan?" });
    await confirm.getByRole("button", { name: "Hapus anggaran" }).click();
    await expect(page.getByRole("heading", { name: "Belum ada anggaran di bulan ini" })).toBeVisible();
  });
});

test("bulan berjalan menampilkan total dan prediksi akhir bulan", async ({ page }) => {
  await page.goto("/anggaran");
  await expect(page.getByText("Terpakai dari total anggaran")).toBeVisible();
  const forecast = page.getByRole("region", { name: /Prediksi/ });
  await expect(forecast).toBeVisible();
  await forecast.getByRole("button", { name: "Cara menghitung" }).click();
  await expect(forecast.getByText("Sisa hari")).toBeVisible();
});
