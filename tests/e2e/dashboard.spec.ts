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
  await page.getByRole("button", { name: "Cara menghitung arus bulan ini" }).click();
  await expect(page.getByRole("dialog", { name: "Arus bulan ini" })).toContainText("Rasio tabungan = (pemasukan - pengeluaran) / pemasukan");
});

test("kategori menautkan ke Transaksi dengan filter", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("#pengeluaran-kategori").locator("xpath=ancestor::section").getByRole("link").first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/transaksi\?kategori=[0-9a-f-]{36}&dari=\d{4}-\d{2}-\d{2}&sampai=\d{4}-\d{2}-\d{2}$/);
});
