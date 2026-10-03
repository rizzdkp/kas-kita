import { execFileSync } from "node:child_process";
import { expect, test, type Browser } from "@playwright/test";

const NADIA = "nadia@kaskita.local";
const PASSWORD = process.env.DEV_SEED_PASSWORD?.trim() || "kaskita-dev-123";

// IP acak per konteks supaya hitungan rate limit per IP tidak menumpuk antar run
async function freshContext(browser: Browser) {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
}

test.describe("login email + password", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(() => {
    // database yang di-seed sebelum seed menyetel password tetap bisa dipakai
    execFileSync("npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/dev-set-passwords.ts"], { encoding: "utf8" });
  });

  test("halaman /login: fokus di email, label terbaca, tanpa passkey", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Kas Kita" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Tampilkan password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await expect(page.getByText(/passkey|autentikator/i)).toHaveCount(0);
    await context.close();
  });

  test("password salah menampilkan pesan, lalu password benar masuk dan keluar kembali ke /login", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.goto("/transaksi");
    await expect(page).toHaveURL(/\/login\?next=%2Ftransaksi/);

    await page.getByLabel("Email").fill(NADIA);
    await page.getByLabel("Password", { exact: true }).fill("bukan-password-nadia");
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page.getByRole("region", { name: "Kas Kita" }).getByRole("alert")).toHaveText("Email atau password salah. Cek lagi lalu coba lagi.");

    // login berhasil juga menghapus hitungan gagal email, jadi run berulang tidak mengunci akun seed
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Ingat perangkat ini (30 hari)").check();
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/transaksi$/, { timeout: 60_000 });

    await page.goto("/pengaturan#sesi");
    await expect(page.locator("#sesi").getByText("Perangkat tepercaya, sesi 30 hari").first()).toBeVisible();

    await page.getByRole("button", { name: /^Menu akun/ }).first().click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("form kosong memberi pesan tanpa mengirim", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByRole("region", { name: "Kas Kita" }).getByRole("alert")).toHaveText("Isi email dan password untuk masuk.");
    await context.close();
  });

  test("sesi berakhir menampilkan pesan COPY", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.goto("/login?sesi=berakhir");
    await expect(page.getByText("Sesimu berakhir. Masuk lagi untuk melanjutkan.")).toBeVisible();
    await context.close();
  });
});
