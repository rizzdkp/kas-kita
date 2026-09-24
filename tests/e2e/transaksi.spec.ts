import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/session";

// alur utama halaman Transaksi: F-IN-1, F-HIST-1, F-HIST-2, F-HIST-3; menulis ke DB dev dengan catatan unik
test.describe.configure({ mode: "serial" });

const marker = `E2E ${Date.now().toString(36)}`;
let txId = "";

async function openForm(page: Page) {
  await page.getByRole("button", { name: "Tambah transaksi" }).first().click();
  await expect(page.getByRole("dialog", { name: "Tambah transaksi" })).toBeVisible();
}

function row(page: Page) {
  return page.getByRole("region", { name: "Daftar transaksi" }).getByRole("button", { name: new RegExp(marker) });
}

async function choose(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("tambah transaksi lewat form, Enter mengirim", async ({ page, context }) => {
  await loginAs(context);
  await page.goto("/transaksi");
  await openForm(page);
  const form = page.getByRole("dialog", { name: "Tambah transaksi" });
  await form.getByLabel("Nominal").fill("37rb");
  await choose(page, "Akun", "BCA Rizz");
  await choose(page, "Kategori", "Kopi dan jajan");
  await form.getByLabel("Catatan").fill(marker);
  await form.getByLabel("Catatan").press("Enter");
  await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
  await expect(form).toBeHidden();
  await expect(row(page)).toBeVisible();
});

test("filter teks menyaring daftar dan tampil sebagai chip", async ({ page, context }) => {
  await loginAs(context);
  await page.goto("/transaksi");
  await page.getByRole("searchbox", { name: "Cari transaksi" }).fill(marker);
  await expect(page).toHaveURL(/q=E2E/);
  await expect(row(page)).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Filter aktif" })).toContainText(marker);

  await page.getByRole("searchbox", { name: "Cari transaksi" }).fill(`${marker} tidak ada`);
  await expect(page.getByRole("heading", { name: "Tidak ada transaksi yang cocok" })).toBeVisible();
});

test("detail menampilkan riwayat setelah edit", async ({ page, context }) => {
  await loginAs(context);
  await page.goto(`/transaksi?q=${encodeURIComponent(marker)}`);
  await row(page).click();
  await expect(page).toHaveURL(/id=/);
  txId = new URL(page.url()).searchParams.get("id") ?? "";
  const detail = page.getByRole("dialog", { name: marker });
  await expect(detail).toContainText("Rp 37.000");

  await detail.getByRole("button", { name: "Ubah" }).click();
  const form = page.getByRole("dialog", { name: "Ubah transaksi" });
  await form.getByLabel("Nominal").fill("42.000");
  await form.getByRole("button", { name: "Simpan" }).click();
  await expect(form).toBeHidden();

  const history = detail.getByRole("region", { name: "Riwayat" });
  await expect(history).toContainText("mengubah");
  await expect(history).toContainText("Nominal");
  await expect(history).toContainText("Rp 37.000");
  await expect(history).toContainText("Rp 42.000");
  await expect(history).toContainText("mencatat transaksi ini");
});

test("hapus lalu urungkan", async ({ page, context }) => {
  await loginAs(context);
  await page.goto(`/transaksi?q=${encodeURIComponent(marker)}&id=${txId}`);
  const detail = page.getByRole("dialog", { name: marker });
  await detail.getByRole("button", { name: "Hapus" }).click();
  const confirm = page.getByRole("dialog", { name: "Hapus transaksi ini?" });
  await expect(confirm).toContainText("Transaksi masuk ke Baru dihapus dan bisa dipulihkan selama 30 hari.");
  await confirm.getByRole("button", { name: "Hapus transaksi" }).click();
  await expect(page.getByText("Transaksi dihapus")).toBeVisible();
  await expect(row(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Urungkan" }).click();
  await expect(page.getByText("Transaksi dipulihkan")).toBeVisible();
  await expect(row(page)).toBeVisible();
});

test("konflik edit: Rizz dan Nadia mengubah transaksi yang sama", async ({ browser, baseURL }) => {
  const rizz = await browser.newContext({ baseURL });
  const nadia = await browser.newContext({ baseURL });
  await loginAs(rizz, "rizz@kaskita.local");
  await loginAs(nadia, "nadia@kaskita.local");
  const pageR = await rizz.newPage();
  const pageN = await nadia.newPage();
  await pageR.goto(`/transaksi?id=${txId}`);
  await pageN.goto(`/transaksi?id=${txId}`);

  const detailR = pageR.getByRole("dialog", { name: marker });
  const detailN = pageN.getByRole("dialog", { name: marker });
  await expect(detailN).toContainText("Milik Rizz");
  await detailR.getByRole("button", { name: "Ubah" }).click();
  await detailN.getByRole("button", { name: "Ubah" }).click();

  const formN = pageN.getByRole("dialog", { name: "Ubah transaksi" });
  await formN.getByLabel("Nominal").fill("45.000");
  await formN.getByRole("button", { name: "Simpan" }).click();
  await expect(pageN.getByText("Tersimpan. Rizz akan melihat perubahan ini di riwayat.")).toBeVisible();

  const formR = pageR.getByRole("dialog", { name: "Ubah transaksi" });
  await formR.getByLabel("Nominal").fill("50.000");
  await formR.getByRole("button", { name: "Simpan" }).click();
  const conflict = pageR.getByRole("dialog", { name: /Transaksi ini baru diubah Nadia pukul \d{2}\.\d{2}/ });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText("Rp 45.000");
  await expect(conflict).toContainText("Rp 50.000");
  await expect(conflict.getByText("Berbeda")).toHaveCount(1);

  await conflict.getByRole("button", { name: "Pakai versi saya" }).click();
  await expect(pageR.getByText("Tersimpan", { exact: true })).toBeVisible();
  await expect(detailR).toContainText("Rp 50.000");

  await rizz.close();
  await nadia.close();
});
