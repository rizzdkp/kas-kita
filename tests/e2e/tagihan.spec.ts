import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("tambah tagihan perkiraan, bayar dengan nominal berbeda, lalu hapus", async ({ page }) => {
  const name = `E2E Langganan ${Date.now()}`;
  await page.goto("/tagihan");

  await test.step("tambah tagihan", async () => {
    await page.getByRole("button", { name: "Tambah tagihan" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Tambah tagihan" });
    await sheet.getByLabel("Nama tagihan").fill(name);
    await sheet.getByLabel("Nominal", { exact: true }).fill("49rb");
    await sheet.getByText("Nominal perkiraan").click();
    await sheet.getByRole("combobox", { name: "Kategori" }).click();
    await page.getByRole("option", { name: "Hiburan", exact: true }).click();
    await sheet.getByRole("button", { name: "Simpan" }).click();
    await expect(sheet).toBeHidden();
  });

  const row = page.getByRole("region", { name: "Berikutnya" }).getByRole("listitem").filter({ hasText: name });
  await test.step("baris: perkiraan dan hitung mundur hari ini", async () => {
    await expect(row).toContainText("perkiraan");
    await expect(row).toContainText("Rp 49.000");
    await expect(row).toContainText("Hari ini");
  });

  await test.step("bayar dengan nominal yang disesuaikan", async () => {
    await row.getByRole("button", { name: `Bayar ${name}` }).click();
    const dialog = page.getByRole("dialog", { name: `Bayar ${name}` });
    await dialog.getByLabel("Nominal").fill("52.500");
    await dialog.getByRole("button", { name: "Bayar Rp 52.500" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} dibayar` })).toBeVisible();
    const paid = page.getByRole("region", { name: /Lunas periode ini/ });
    await expect(paid.getByRole("listitem").filter({ hasText: name })).toContainText("Rp 52.500");
    // jatuh tempo maju sebulan, jadi hitung mundur tidak lagi "Hari ini"
    await expect(row).not.toContainText("Hari ini");
  });

  await test.step("hapus tagihan", async () => {
    await row.getByRole("button", { name: `Aksi untuk ${name}` }).click();
    await page.getByRole("menuitem", { name: "Hapus tagihan" }).click();
    await page.getByRole("dialog", { name: `Hapus tagihan ${name}?` }).getByRole("button", { name: "Hapus tagihan" }).click();
    await expect(page.getByRole("region", { name: "Berikutnya" }).getByText(name)).toHaveCount(0);
  });
});
