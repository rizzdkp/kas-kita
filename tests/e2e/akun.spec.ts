import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

test("tambah akun, cocokkan saldo membuat penyesuaian, lalu arsipkan", async ({ page }) => {
  const name = `E2E Bank ${Date.now()}`;

  await test.step("tambah akun", async () => {
    await page.goto("/akun?scope=me");
    await page.getByRole("button", { name: "Tambah akun" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Tambah akun" });
    await sheet.getByLabel("Nama akun").fill(name);
    await sheet.getByLabel("Saldo awal", { exact: true }).fill("1000000");
    await sheet.getByRole("button", { name: "Tambah akun" }).click();
    await expect(sheet).toBeHidden();
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText("Rp 1.000.000");
    await expect(row).toContainText("Belum pernah dicocokkan");
  });

  await test.step("rekonsiliasi membuat transaksi penyesuaian", async () => {
    await page.getByRole("button", { name: `Aksi untuk ${name}` }).click();
    await page.getByRole("menuitem", { name: "Cocokkan saldo" }).click();
    const sheet = page.getByRole("dialog", { name: `Cocokkan saldo ${name}` });
    await sheet.getByLabel("Saldo di aplikasi bank").fill("1250000");
    await expect(sheet.getByText("+Rp 250.000")).toBeVisible();
    // 250.000 dari 1.000.000 = 25%, di atas batas 1%
    await expect(sheet.getByText(/lebih dari 1% saldo/)).toBeVisible();
    await sheet.getByRole("button", { name: "Buat penyesuaian" }).click();
    await expect(page.getByText("Penyesuaian dibuat")).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText("Rp 1.250.000");
    await expect(row).toContainText("Dicocokkan hari ini");
  });

  await test.step("akun bertransaksi tidak bisa dihapus, lalu diarsipkan", async () => {
    await page.getByRole("button", { name: `Aksi untuk ${name}` }).click();
    await page.getByRole("menuitem", { name: "Hapus akun" }).click();
    const dialog = page.getByRole("dialog", { name: `Hapus ${name}?` });
    await dialog.getByRole("button", { name: "Hapus akun" }).click();
    const blocked = page.getByRole("dialog", { name: `${name} tidak bisa dihapus` });
    await expect(blocked).toContainText("punya transaksi");
    await blocked.getByRole("button", { name: "Arsipkan" }).click();
    await expect(page.getByText("Diarsipkan", { exact: true })).toBeVisible();

    const archived = page.locator("details").filter({ hasText: /Diarsipkan \(\d+\)/ });
    await archived.locator("summary").click();
    await expect(archived.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  });
});

test("tautan ?baru=1&jenis=investment membuka form dengan jenis Investasi", async ({ page }) => {
  await page.goto("/akun?baru=1&jenis=investment");
  const sheet = page.getByRole("dialog", { name: "Tambah akun" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Jenis")).toContainText("Investasi");
  await expect(sheet.getByLabel("Modal awal")).toBeVisible();
});
