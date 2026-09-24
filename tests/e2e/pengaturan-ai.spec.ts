import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

// butuh server AI palsu: FAKE_AI_PORT=4011 npx tsx scripts/fake-ai-server.ts
const FAKE_AI_URL = process.env.E2E_FAKE_AI_URL ?? "http://localhost:4011/v1";
const API_KEY = "sk-e2e-rahasia-9f3k";

test.describe("pengaturan AI", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test("isi, ambil daftar model, pilih, tes koneksi, simpan, lalu hapus", async ({ page, context }) => {
    await loginAs(context);
    await page.goto("/pengaturan#ai");
    const section = page.locator("#ai");
    await expect(section.getByText("Foto struk dan teks transaksi dikirim ke penyedia yang kamu pasang di sini.")).toBeVisible();

    await section.getByLabel("Base URL").fill(FAKE_AI_URL);
    await section.getByLabel("API key").fill(API_KEY);
    await section.getByRole("button", { name: "Ambil daftar model" }).click();
    await expect(section.getByText("2 model ditemukan")).toBeVisible();

    // cari di combobox lalu pilih dengan keyboard
    const text = section.getByRole("combobox", { name: "Model teks" });
    await text.fill("text");
    const textList = section.getByRole("listbox", { name: "Model teks" });
    await expect(textList.getByRole("option")).toHaveText(["fake-text"]);
    await text.press("ArrowDown");
    await text.press("Enter");
    await expect(text).toHaveValue("fake-text");
    await expect(textList).toBeHidden();

    // pilih dengan klik
    const vision = section.getByRole("combobox", { name: "Model vision" });
    await vision.click();
    await section.getByRole("listbox", { name: "Model vision" }).getByRole("option", { name: "fake-vision" }).click();
    await expect(vision).toHaveValue("fake-vision");

    await section.getByRole("button", { name: "Tes koneksi" }).click();
    await expect(section.getByText("Model teks dan model vision merespons")).toBeVisible({ timeout: 30_000 });

    await section.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible();
    await expect(section.getByText("Tersimpan, berakhiran ••••9f3k")).toBeVisible();
    await expect(section.getByLabel("API key")).toHaveValue("");

    // setelah muat ulang, key tidak pernah ada di HTML; base URL dan model tetap
    await page.reload();
    await expect(section.getByText("Tersimpan, berakhiran ••••9f3k")).toBeVisible();
    await expect(section.getByLabel("Base URL")).toHaveValue(FAKE_AI_URL);
    await expect(section.getByRole("combobox", { name: "Model vision" })).toHaveValue("fake-vision");
    expect(await page.content()).not.toContain(API_KEY);

    // tes koneksi dengan key tersimpan (field key kosong)
    await section.getByRole("button", { name: "Tes koneksi" }).click();
    await expect(section.getByText("Model teks dan model vision merespons")).toBeVisible({ timeout: 30_000 });

    await section.getByRole("button", { name: "Hapus pengaturan AI" }).click();
    const dialog = page.getByRole("dialog", { name: "Hapus pengaturan AI?" });
    await dialog.getByRole("button", { name: "Hapus pengaturan AI" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pengaturan AI dihapus" })).toBeVisible();
    await expect(section.getByText("AI belum dipasang.")).toBeVisible();
    await expect(section.getByLabel("Base URL")).toHaveValue("");
  });
});
