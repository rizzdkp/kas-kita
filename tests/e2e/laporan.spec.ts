import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("navigasi bulan lewat ?bulan=", async ({ page }) => {
  await page.goto("/laporan?bulan=2026-08");
  await expect(page.getByTestId("report-month")).toHaveText("Agustus 2026");
  await page.getByRole("link", { name: /^Bulan sebelumnya/ }).click();
  await expect(page).toHaveURL(/bulan=2026-07/, { timeout: 15_000 });
  await expect(page.getByTestId("report-month")).toHaveText("Juli 2026");
  await page.getByRole("link", { name: /^Bulan berikutnya/ }).click();
  await expect(page).toHaveURL(/bulan=2026-08/, { timeout: 15_000 });
  await expect(page.getByTestId("report-month")).toHaveText("Agustus 2026");
});

test("bulan depan tidak bisa dibuka dan jatuh ke bulan berjalan", async ({ page }) => {
  await page.goto("/laporan?bulan=2999-01");
  await expect(page.getByRole("link", { name: /^Bulan berikutnya/ })).toHaveCount(0);
});

test("klik kategori membuka Transaksi dengan filter kategori dan periode", async ({ page }) => {
  await page.goto("/laporan?bulan=2026-08");
  const row = page.getByTestId("pengeluaran-kategori-list").getByRole("link").first();
  const id = await row.getAttribute("data-category-id");
  await row.click();
  // rute Transaksi dikompilasi saat pertama dibuka di dev
  await expect(page).toHaveURL(new RegExp(`/transaksi\\?kategori=${id}&jenis=pengeluaran&dari=2026-08-01&sampai=2026-08-31$`), { timeout: 30_000 });
});

test("unduh CSV transaksi dengan filter aktif", async ({ page }) => {
  await page.goto("/laporan?bulan=2026-08&scope=all");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Unduh CSV" }).click()]);
  expect(download.suggestedFilename()).toBe("kas-kita-transaksi-2026-08-01-sampai-2026-08-31.csv");
  const text = await readFile((await download.path())!, "utf8");
  expect(text.startsWith("\uFEFF")).toBe(true);
  const lines = text.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe("Tanggal,Waktu,Jenis,Nominal,Akun,Akun tujuan,Kategori,Catatan,Diisi oleh,Tag,Status");
  expect(lines.length).toBeGreaterThan(1);
  for (const line of lines.slice(1)) expect(line).toMatch(/^2026-08-\d{2},\d{2}:\d{2},(Pemasukan|Pengeluaran|Transfer),\d+,/);
});

test("CSV tanpa sesi ditolak", async ({ request }) => {
  const res = await request.get("/api/export/transaksi.csv", { headers: { cookie: "" } });
  expect(res.status()).toBe(401);
});

test("halaman cetak berisi ringkasan bulanan", async ({ page }) => {
  await page.goto("/laporan?bulan=2026-08");
  await page.getByRole("link", { name: "Cetak / simpan PDF" }).click();
  await expect(page).toHaveURL(/\/laporan\/cetak\?bulan=2026-08/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Laporan keuangan Agustus 2026" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cetak / simpan PDF" })).toBeVisible();
});
