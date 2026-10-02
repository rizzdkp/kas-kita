import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/session";

// F-IN-5 tanpa AI: e-statement contoh-bank (format sintetis) → tinjau; PDF berpassword; PDF tak dikenal
// fixture: tests/fixtures/statements/ (generate.ts), password "contoh123"

const FIXTURES = join(process.cwd(), "tests/fixtures/statements");

test.describe.configure({ mode: "serial" });

let account: { accountId: string; name: string };

test.beforeAll(() => {
  const out = execFileSync("bash", ["-c", "set -a; . ./.env.local; set +a; npx tsx tests/e2e/helpers/import-pdf-account.ts"], { encoding: "utf8" });
  account = JSON.parse(out.trim().split("\n").at(-1)!) as typeof account;
});

test.beforeEach(async ({ context }) => {
  test.setTimeout(90_000);
  await loginAs(context);
});

async function pick(page: Page, file: string) {
  await page.goto(`/impor?akun=${account.accountId}`);
  await expect(page.getByRole("radio", { name: new RegExp(account.name) })).toBeChecked();
  await page.locator('main input[type="file"]').setInputFiles(join(FIXTURES, file));
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
}

test("e-statement contoh-bank terbaca dan masuk layar tinjau", async ({ page }) => {
  await pick(page, "contoh-bank/mutasi-agustus.pdf");
  await expect(page).toHaveURL(/\/impor\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: `Tinjau mutasi ${account.name}` })).toBeVisible();
  await expect(page.getByText(/13 baris dari PDF/)).toBeVisible();
  await expect(page.getByText("GAJI AGUSTUS 2026 PT CONTOH SEJAHTERA", { exact: true })).toBeVisible();
  await expect(page.getByText(/Saldo berjalan tidak cocok/)).toHaveCount(0);
});

test("saldo tercetak tidak cocok: tinjau menandai baris yang perlu dicek", async ({ page }) => {
  await pick(page, "contoh-bank/mutasi-agustus-saldo-selisih.pdf");
  await expect(page).toHaveURL(/\/impor\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByText("Saldo berjalan tidak cocok di 2 baris.", { exact: false })).toBeVisible();
});

test("PDF berpassword: minta password, password salah diberi tahu, password benar lanjut ke tinjau", async ({ page }) => {
  await pick(page, "contoh-bank/mutasi-agustus-berpassword.pdf");
  const dialog = page.getByRole("dialog", { name: "PDF ini berpassword" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  const input = dialog.getByLabel("Password e-statement");
  await input.fill("salah");
  await dialog.getByRole("button", { name: "Buka PDF" }).click();
  await expect(dialog.getByText("Password tidak cocok. Password e-statement biasanya dikirim bank lewat email atau SMS.")).toBeVisible();
  await input.fill("contoh123");
  await dialog.getByRole("button", { name: "Buka PDF" }).click();
  await expect(page).toHaveURL(/\/impor\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByText(/13 baris dari PDF/)).toBeVisible();
});

test("PDF yang formatnya belum dikenali tanpa AI: menjelaskan sebab dan arah berikutnya", async ({ page }) => {
  await pick(page, "tidak-dikenal/dompet-contoh.pdf");
  await expect(page.getByRole("alert").filter({ hasText: "Format mutasi ini belum dikenali." })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/impor\?akun=/);
});
