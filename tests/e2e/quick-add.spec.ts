import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/session";

// F-IN-2 tanpa AI: parser lokal, kartu pratinjau, simpan, urungkan

function psql(query: string): string {
  return execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; psql "$DATABASE_URL" -At -c ${JSON.stringify(query)}`], {
    encoding: "utf8",
  }).trim();
}

const tags: string[] = [];

// hanya huruf supaya parser tidak membaca penanda sebagai nominal
function tag(prefix: string): string {
  const t = prefix + Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
  tags.push(t);
  return t;
}

test.afterAll(() => {
  // bersihkan transaksi tes dari DB dev supaya saldo seed tidak bergeser
  for (const t of tags) {
    psql(`update transactions set deleted_at = now() where source = 'quick_add' and note ilike '%${t}%' and deleted_at is null`);
  }
});

const SAVE_TIMEOUT = { timeout: 20_000 };

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

function bar(page: Page) {
  return page.getByRole("textbox", { name: "Catat transaksi" });
}

async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(bar(page)).toBeVisible({ timeout: 60_000 });
}

test("shortcut / memfokuskan bar", async ({ page }) => {
  await openApp(page);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  await expect(bar(page)).toBeFocused();
  await expect(bar(page)).toHaveValue("");
});

test("kopi 25rb gopay: Enter, kartu, Enter, Tersimpan, muncul di riwayat", async ({ page }) => {
  const note = `Kopi ${tag("uji")}`;
  await openApp(page);
  await bar(page).fill(`${note.toLowerCase()} 25rb gopay`);
  await bar(page).press("Enter");

  const card = page.getByTestId("quick-add-card");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("combobox", { name: "Jenis" })).toHaveText("Pengeluaran");
  await expect(card.getByRole("button", { name: /Nominal/ })).toContainText("Rp 25.000");
  await expect(card.getByRole("combobox", { name: "Akun" })).toContainText("GoPay Rizz");
  await expect(card.getByRole("combobox", { name: "Kategori" })).toHaveText("Kopi dan jajan");
  await expect(card.getByRole("combobox", { name: "Untuk" })).toHaveText("Untuk: Kamu");
  // tidak ada simpan otomatis (AC3)
  expect(psql(`select count(*) from transactions where note ilike '${note}'`)).toBe("0");

  await expect(page.getByRole("button", { name: "Simpan", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible(SAVE_TIMEOUT);
  await expect(card).toHaveCount(0);

  const row = psql(`select amount, source, beneficiary from transactions where note ilike '${note}' and deleted_at is null`);
  expect(row).toBe("25000|quick_add|owner");

  await page.goto("/transaksi");
  await expect(page.getByText(note, { exact: false }).first()).toBeVisible({ timeout: 60_000 });
});

test("beberapa baris menghasilkan beberapa kartu dan Simpan semua", async ({ page }) => {
  const t = tag("ujim");
  await openApp(page);
  await bar(page).fill(`makan siang ${t} 45rb bca`);
  await bar(page).press("Shift+Enter");
  await bar(page).pressSequentially(`parkir ${t} 5rb gopay`);
  await bar(page).press("Enter");

  await expect(page.getByTestId("quick-add-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Simpan semua" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible(SAVE_TIMEOUT);
  expect(psql(`select count(*) from transactions where note ilike '%${t}%' and deleted_at is null`)).toBe("2");
});

test("field kosong ditandai dan Simpan tertahan dengan alasan tertulis", async ({ page }) => {
  await openApp(page);
  await bar(page).fill("sesuatu tanpa nominal");
  await bar(page).press("Enter");

  const card = page.getByTestId("quick-add-card");
  await expect(card.getByRole("button", { name: /Nominal/ })).toContainText("Isi nominal");
  await expect(card.getByRole("combobox", { name: "Jenis" })).toContainText("Pilih jenis");
  const save = page.getByRole("button", { name: "Simpan", exact: true });
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Lengkapi jenis dan nominal untuk menyimpan.")).toBeVisible();

  await card.getByRole("combobox", { name: "Jenis" }).click();
  await page.getByRole("option", { name: "Pengeluaran" }).click();
  await card.getByRole("button", { name: /Nominal/ }).click();
  await page.getByLabel("Nominal").fill("12rb");
  await page.getByLabel("Nominal").press("Enter");
  await card.getByRole("combobox", { name: "Kategori" }).click();
  await page.getByRole("option", { name: "Lainnya" }).click();
  await expect(save).not.toHaveAttribute("aria-disabled", "true");

  // Esc membatalkan dan mengembalikan teks ke bar
  await save.focus();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(bar(page)).toHaveValue("sesuatu tanpa nominal");
});

test("Urungkan menghapus transaksi yang baru disimpan", async ({ page }) => {
  const t = tag("ujiu");
  await openApp(page);
  await bar(page).fill(`kopi ${t} 18rb gopay`);
  await bar(page).press("Enter");
  await page.keyboard.press("Enter");
  const toast = page.getByRole("status").filter({ hasText: "Tersimpan" });
  await expect(toast).toBeVisible(SAVE_TIMEOUT);
  await toast.getByRole("button", { name: "Urungkan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Diurungkan" })).toBeVisible(SAVE_TIMEOUT);
  expect(psql(`select count(*) from transactions where note ilike '%${t}%' and deleted_at is not null`)).toBe("1");
});

test("saldo tunai kurang tampil di kartu", async ({ page }) => {
  await openApp(page);
  await bar(page).fill("bakso 900jt tunai");
  await bar(page).press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("quick-add-card").getByRole("alert")).toContainText("Saldo Tunai", SAVE_TIMEOUT);
});

test("cakupan Partner: dicatat atas nama partner", async ({ page }) => {
  await openApp(page, "/?scope=partner");
  await expect(bar(page)).toHaveAttribute("placeholder", "Catat untuk Nadia, misalnya makan 40rb");
  await bar(page).fill("makan 40rb");
  await bar(page).press("Enter");
  await expect(page.getByText("Dicatat atas nama Nadia, diisi oleh kamu")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("tombol kamera menjelaskan butuh model vision", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Foto struk" }).click();
  const dialog = page.getByRole("dialog", { name: "Foto struk butuh model vision" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Buka pengaturan AI" })).toHaveAttribute("href", "/pengaturan#ai");
});

test("offline: masuk antrean lalu terkirim saat online dengan clientId yang sama", async ({ page, context }) => {
  const t = tag("ujio");
  await openApp(page);
  await context.setOffline(true);
  await bar(page).fill(`kopi ${t} 11rb gopay`);
  await bar(page).press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Tersimpan di perangkat" })).toBeVisible(SAVE_TIMEOUT);
  expect(psql(`select count(*) from transactions where note ilike '%${t}%'`)).toBe("0");

  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Transaksi dari antrean tersimpan" })).toBeVisible(SAVE_TIMEOUT);
  expect(psql(`select count(*) from transactions where note ilike '%${t}%' and client_id is not null`)).toBe("1");
});
