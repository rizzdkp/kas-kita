import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

interface StagedBatch {
  batchId: string;
  accountId: string;
  manualId: string;
  token: string;
}

// batch disiapkan lewat pipeline langsung supaya tes tidak bergantung pada UI unggah
function stageBatch(format: "csv" | "ai_pdf" = "csv"): StagedBatch {
  const out = execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; npx tsx tests/e2e/helpers/import-batch.ts ${format}`], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").at(-1) ?? "{}") as StagedBatch;
}

test.describe("layar tinjau impor", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context);
  });

  test("tiga kelompok dengan default F-IN-6 AC3 dan penanda saldo", async ({ page }) => {
    const b = stageBatch();
    await page.goto(`/impor/${b.batchId}`);

    await expect(page.getByRole("heading", { name: `Tinjau mutasi E2E Impor ${b.token}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Baru (4)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kemungkinan duplikat (1)" })).toBeVisible();

    // Baru dicentang
    const newRows = page.getByRole("list", { name: "Baris baru" }).getByRole("checkbox");
    await expect(newRows).toHaveCount(4);
    for (const box of await newRows.all()) await expect(box).toBeChecked();
    await expect(page.getByText("4 dari 4")).toBeVisible();

    // Kemungkinan duplikat tidak dicentang, pembanding tampil berdampingan
    const decision = page.getByRole("radiogroup", { name: `Keputusan untuk INDOMARET ${b.token}` });
    await expect(decision.getByRole("radio", { name: "Lewati" })).toBeChecked();
    await expect(page.getByText(`Belanja Indomaret ${b.token}`)).toBeVisible();
    await expect(page.getByText("Selisih 1 hari")).toBeVisible();

    // Duplikat pasti disembunyikan, hanya jumlah
    const exact = page.getByText(`PARKIR LAMA ${b.token}`);
    await expect(exact).toBeHidden();
    await page.getByText("Duplikat pasti (1)").click();
    await expect(exact).toBeVisible();

    await expect(page.getByText("Saldo berjalan tidak cocok di 1 baris.", { exact: false })).toBeVisible();
    await expect(page.getByText("Perlu dicek")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Impor 4 transaksi" })).toBeVisible();
  });

  test("kategori wajib, tautkan duplikat, lalu commit ke daftar transaksi dengan filter batch", async ({ page }) => {
    const b = stageBatch();
    await page.goto(`/impor/${b.batchId}`);

    await page.getByText("Centang semua baris baru").click();
    await expect(page.getByText("0 dari 4")).toBeVisible();
    await page.getByRole("checkbox", { name: new RegExp(`^Impor ZQXV WPLM ${b.token}`) }).check();

    await page.getByRole("button", { name: "Impor 1 transaksi" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Pilih kategori untuk 1 transaksi yang dicentang." })).toBeVisible();
    const category = page.getByRole("combobox", { name: `Kategori untuk ZQXV WPLM ${b.token}` });
    await expect(category).toHaveAttribute("aria-invalid", "true");
    await expect(category).toBeFocused();

    await category.click();
    await page.getByRole("option").first().click();
    await expect(category).not.toHaveAttribute("aria-invalid", "true");

    const decision = page.getByRole("radiogroup", { name: `Keputusan untuk INDOMARET ${b.token}` });
    await decision.getByText("Sama, tautkan").click();
    await expect(decision.getByRole("radio", { name: "Sama, tautkan" })).toBeChecked();
    await expect(page.getByText("1 diimpor · 1 ditautkan · 4 dilewati")).toBeVisible();

    await page.getByRole("button", { name: "Impor 1 transaksi" }).click();
    await page.waitForURL(new RegExp(`/transaksi\\?batch=${b.batchId}`));
    await expect(page.getByText("1 transaksi diimpor, 1 ditautkan")).toBeVisible();
    await expect(page.getByText(`ZQXV WPLM ${b.token}`)).toBeVisible();
    await expect(page.getByText(`Belanja Indomaret ${b.token}`)).toBeVisible();
    await expect(page.getByText(`KOPI KENANGAN ${b.token}`)).toHaveCount(0);

    // layar tinjau batch yang sudah disimpan menawarkan hasilnya
    await page.goto(`/impor/${b.batchId}`);
    await expect(page.getByRole("heading", { name: "Impor ini sudah disimpan" })).toBeVisible();
  });

  test("batch hasil AI menampilkan peringatan cek baris per baris", async ({ page }) => {
    const b = stageBatch("ai_pdf");
    await page.goto(`/impor/${b.batchId}`);
    await expect(page.getByText("Mutasi ini dibaca model AI. Cek tanggal, deskripsi, dan nominal setiap baris sebelum mengimpor.")).toBeVisible();
    await expect(page.getByText("6 baris dari PDF, dibaca AI", { exact: false })).toBeVisible();
  });

  test("batal impor menghapus batch", async ({ page }) => {
    const b = stageBatch();
    await page.goto(`/impor/${b.batchId}`);
    await page.getByRole("button", { name: "Batalkan impor" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Batalkan impor" }).click();
    await page.waitForURL(/\/impor(\?|$)/);
    await page.goto(`/impor/${b.batchId}`);
    await expect(page.getByRole("heading", { name: "Impor ini tidak ditemukan" })).toBeVisible();
  });
});
