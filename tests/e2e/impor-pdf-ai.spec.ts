import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

// F-IN-5 AC3: PDF tak dikenal → "Baca dengan AI" → worker pg-boss membaca per halaman → polling → tinjau dengan peringatan
// fixture AI: tests/fixtures/ai/pdf_extract.json (3 baris); worker dijalankan spec ini sendiri (pnpm worker)

const FAKE_PORT = Number(process.env.IMPOR_PDF_FAKE_PORT ?? 4014);
const BASE_URL = `http://localhost:${FAKE_PORT}/v1`;
const FILE = join(process.cwd(), "tests/fixtures/statements/tidak-dikenal/dompet-contoh.pdf");

test.describe.configure({ mode: "serial" });

function sh(command: string): string {
  return execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; ${command}`], { encoding: "utf8" }).trim();
}

let fake: ChildProcess | null = null;
let worker: ChildProcess | null = null;
let snapshot = "null";
let account: { accountId: string; name: string };

async function stop(proc: ChildProcess | null): Promise<void> {
  if (!proc || proc.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
  });
}

test.beforeAll(async () => {
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(FAKE_PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 100 && !(await fetch(`${BASE_URL}/models`).then((r) => r.ok, () => false)); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  snapshot = sh(`npx tsx tests/e2e/helpers/struk-ai-settings.ts set '${BASE_URL}'`).split("\n").at(-1) ?? "null";
  account = JSON.parse(sh("npx tsx tests/e2e/helpers/import-pdf-account.ts").split("\n").at(-1)!) as typeof account;
  // exec supaya SIGTERM sampai ke proses worker, bukan hanya ke bash
  worker = spawn("bash", ["-c", "set -a; . ./.env.local; set +a; exec node --import tsx src/worker/index.ts"], { stdio: "ignore" });
});

test.afterAll(async () => {
  await stop(worker);
  await stop(fake);
  sh(`npx tsx tests/e2e/helpers/struk-ai-settings.ts restore '${snapshot.replaceAll("'", "'\\''")}'`);
  // akun uji dengan transaksi baru tidak boleh jadi "akun terakhir dipakai" bagi spesifikasi berikutnya
  if (account) {
    sh(
      `psql "$DATABASE_URL" -qc "update transactions set deleted_at = now(), version = version + 1 where account_id = '${account.accountId}' and deleted_at is null; update accounts set deleted_at = now(), version = version + 1 where id = '${account.accountId}' and deleted_at is null"`,
    );
  }
});

test.beforeEach(async ({ context }) => {
  test.setTimeout(120_000);
  await loginAs(context);
});

test("PDF tak dikenal dibaca AI lewat worker, layar tinjau memperingatkan untuk cek baris per baris", async ({ page }) => {
  await page.goto(`/impor?akun=${account.accountId}`);
  await expect(page.getByRole("radio", { name: new RegExp(account.name) })).toBeChecked();
  await page.locator('main input[type="file"]').setInputFiles(FILE);
  await page.getByRole("button", { name: "Unggah", exact: true }).click();

  await expect(
    page.getByText("Format mutasi ini belum dikenali. Coba impor CSV, atau baca dengan AI dan cek hasilnya baris per baris."),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Baca dengan AI" }).click();

  await expect(page).toHaveURL(/\/impor\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  // halaman memuat status parsing lalu diperbarui sendiri setelah worker selesai
  await expect(page.getByRole("heading", { name: `Tinjau mutasi ${account.name}` })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Mutasi ini dibaca model AI. Cek tanggal, deskripsi, dan nominal setiap baris sebelum mengimpor.")).toBeVisible();
  await expect(page.getByText(/3 baris dari PDF, dibaca AI/)).toBeVisible();
  await expect(page.getByText("Pembayaran merchant KEDAI CONTOH", { exact: true })).toBeVisible();
});
