import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("perbarui nilai investasi lalu hapus lagi dari riwayat", async ({ page }) => {
  const note = `e2e ${Date.now()}`;
  await page.goto("/investasi?scope=me");
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Reksa Dana Rizz" }) });
  await expect(card.getByText("Modal disetor")).toBeVisible();

  await card.getByRole("button", { name: "Perbarui nilai" }).click();
  const sheet = page.getByRole("dialog", { name: "Perbarui nilai" });
  await sheet.getByLabel("Nilai pasar").fill("15123000");
  await sheet.getByLabel("Catatan").fill(note);
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(sheet).toBeHidden();
  await expect(card.getByText("Rp 15.123.000").first()).toBeVisible();

  await card.locator("summary", { hasText: "Riwayat nilai" }).click();
  const row = card.getByRole("row").filter({ hasText: note });
  await row.getByRole("button", { name: /Hapus nilai/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hapus nilai" }).click();
  await expect(page.getByText("Terhapus", { exact: true })).toBeVisible();
  await expect(card.getByRole("row").filter({ hasText: note })).toHaveCount(0);
});

test("cakupan tanpa akun investasi menampilkan state kosong dengan tautan tambah akun", async ({ page }) => {
  await page.goto("/investasi?scope=partner");
  await expect(page.getByRole("heading", { name: /akun Investasi/ })).toBeVisible();
  await page.getByRole("link", { name: "Tambah akun Investasi" }).click();
  await expect(page.getByRole("dialog", { name: "Tambah akun" })).toBeVisible();
});
