import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("hero tampil dengan label Saya dan angka", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hero-label")).toHaveText(/^Aman dibelanjakan sampai gajian, /);
  await expect(page.getByTestId("hero-value")).toContainText("Rp");
  await expect(page.getByRole("heading", { name: /Arus (bulan|periode) ini/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cek kesehatan" })).toBeVisible();
});

test("ganti cakupan mengubah label hero dan URL", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("radiogroup").filter({ hasText: "Gabungan" }).first();
  await toggle.getByRole("radio", { name: "Gabungan" }).click();
  await expect(page).toHaveURL(/scope=all/);
  await expect(page.getByTestId("hero-label")).toHaveText(/^Kalian berdua: aman dibelanjakan sampai gajian terdekat, /);

  await toggle.getByRole("radio", { name: "Nadia" }).click();
  await expect(page).toHaveURL(/scope=partner/);
  await expect(page.getByTestId("hero-label")).toHaveText(/^Nadia: aman dibelanjakan sampai gajian, /);
});

test("panel Cara menghitung menampilkan rumus dengan angka asli", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Cara menghitung", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Aman dibelanjakan" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Aman dibelanjakan = saldo likuid");
  await expect(panel.getByText("Saldo likuid", { exact: true })).toBeVisible();
  await expect(panel.getByText(/^Rp [\d.]+$/).first()).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cara menghitung rasio tabungan" }).click();
  await expect(page.getByRole("dialog", { name: "Rasio tabungan" })).toContainText("Rasio tabungan = (pemasukan − pengeluaran) / pemasukan");
});

test("periode lalu mengubah arus lewat URL, hero tetap posisi hari ini", async ({ page }) => {
  await page.goto("/");
  const heroLabel = await page.getByTestId("hero-label").textContent();
  const periods = page.getByRole("radiogroup", { name: "Periode arus" });
  await expect(periods.getByRole("radio", { name: /ini$/ })).toBeChecked();

  await periods.getByRole("radio", { name: /lalu$/ }).click();
  await expect(page).toHaveURL(/periode=lalu/);
  await expect(page.getByRole("heading", { name: /^Arus (bulan|periode) lalu/ })).toBeVisible();
  await expect(periods.getByRole("radio", { name: /lalu$/ })).toBeChecked();
  await expect(page.getByTestId("hero-label")).toHaveText(heroLabel ?? "");
  // nilai hero sama di kedua periode dites di tests/integration/dashboard.test.ts; di sini data dev bisa berubah oleh tes lain
  await expect(page.getByText("Dihitung dari posisi hari ini.")).toBeVisible();
  // periode lalu utuh: tanpa garis proyeksi
  await expect(page.getByText(/^Garis putus-putus: proyeksi/)).toHaveCount(0);

  // ganti cakupan mempertahankan pilihan periode
  const toggle = page.getByRole("radiogroup").filter({ hasText: "Gabungan" }).first();
  await toggle.getByRole("radio", { name: "Gabungan" }).click();
  await expect(page).toHaveURL(/scope=all/);
  await expect(page).toHaveURL(/periode=lalu/);

  await periods.getByRole("radio", { name: /ini$/ }).click();
  await expect(page).not.toHaveURL(/periode=/);
  await expect(page.getByRole("heading", { name: /^Arus (bulan|periode) ini/ })).toBeVisible();
});

test("kartu ringkas menautkan ke halaman lengkapnya", async ({ page }) => {
  await page.goto("/?scope=all");
  await expect(page.getByRole("link", { name: "Semua tagihan" })).toHaveAttribute("href", "/tagihan?scope=all");
  await expect(page.getByRole("link", { name: "Semua target" })).toHaveAttribute("href", "/target?scope=all");
  await expect(page.getByRole("link", { name: "Semua akun" })).toHaveAttribute("href", "/akun?scope=all");
  await expect(page.getByRole("link", { name: "Buka Laporan" })).toHaveAttribute("href", "/laporan?scope=all");
  await expect(page.getByRole("heading", { name: "Tren 12 bulan" })).toBeVisible();
});

test("kategori menautkan ke Transaksi dengan filter", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("#pengeluaran-kategori").locator("xpath=ancestor::section").getByRole("link").first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/transaksi\?kategori=[0-9a-f-]{36}&dari=\d{4}-\d{2}-\d{2}&sampai=\d{4}-\d{2}-\d{2}$/);
});
