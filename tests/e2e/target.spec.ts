import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("buat target manual, setor sampai tercapai, lalu hapus", async ({ page }) => {
  const name = `E2E Target ${Date.now()}`;
  await page.goto("/target");

  await test.step("tambah target dengan tenggat", async () => {
    await page.getByRole("button", { name: "Tambah target" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Tambah target" });
    await sheet.getByLabel("Nama target").fill(name);
    await sheet.getByLabel("Nominal target").fill("1jt");
    await sheet.getByLabel("Tenggat").fill("2030-12-31");
    await sheet.getByRole("button", { name: "Simpan" }).click();
    await expect(sheet).toBeHidden();
  });

  const row = page.getByRole("listitem").filter({ hasText: name });
  await test.step("setoran pertama menaikkan progres", async () => {
    await expect(row).toContainText("Setoran bulanan yang dibutuhkan");
    await row.getByRole("button", { name: "Tambah setoran" }).click();
    const dialog = page.getByRole("dialog", { name: `Setor ke ${name}` });
    await dialog.getByLabel("Nominal setoran").fill("400rb");
    await dialog.getByRole("button", { name: "Simpan setoran" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText("40%");
    await expect(row).toContainText("Rp 400.000");
  });

  await test.step("setoran yang melunasi memindahkan target ke Tercapai", async () => {
    await row.getByRole("button", { name: "Tambah setoran" }).click();
    const dialog = page.getByRole("dialog", { name: `Setor ke ${name}` });
    await dialog.getByLabel("Nominal setoran").fill("600rb");
    await dialog.getByRole("button", { name: "Simpan setoran" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Target ${name} tercapai` })).toBeVisible();
    await expect(page.getByRole("region", { name: /Target aktif/ }).getByText(name)).toHaveCount(0);
    const achieved = page.locator("details").filter({ hasText: /Tercapai \(\d+\)/ });
    await achieved.locator("summary").click();
    await expect(achieved.getByRole("listitem").filter({ hasText: name })).toContainText("Tercapai");
  });

  await test.step("hapus", async () => {
    await page.getByRole("button", { name: `Aksi untuk ${name}` }).click();
    await page.getByRole("menuitem", { name: "Hapus target" }).click();
    await page.getByRole("dialog", { name: `Hapus target ${name}?` }).getByRole("button", { name: "Hapus target" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
