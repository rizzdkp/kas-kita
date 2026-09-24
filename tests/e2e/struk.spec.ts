import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

// F-IN-3: unggah → pratinjau → pecah per kategori → tersimpan → lampiran di detail transaksi
// fixture AI: tests/fixtures/ai/receipt.json (struk Indomaret, 8 item, total 168.000); gambar: tests/fixtures/receipts/indomaret.jpg

const FAKE_PORT = Number(process.env.STRUK_FAKE_PORT ?? 4013);
const BASE_URL = `http://localhost:${FAKE_PORT}/v1`;
const PHOTO = join(process.cwd(), "tests/fixtures/receipts/indomaret.jpg");

test.describe.configure({ mode: "serial" });

function sh(command: string): string {
  return execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; ${command}`], { encoding: "utf8" }).trim();
}

function settings(...args: string[]): string {
  return sh(`npx tsx tests/e2e/helpers/struk-ai-settings.ts ${args.map((a) => `'${a}'`).join(" ")}`).split("\n").at(-1) ?? "";
}

let fake: ChildProcess | null = null;
let snapshot = "null";

test.beforeAll(async () => {
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(FAKE_PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 100 && !(await fetch(`${BASE_URL}/models`).then((r) => r.ok, () => false)); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  snapshot = settings("set", BASE_URL);
});

test.afterAll(async () => {
  fake?.kill("SIGTERM");
  settings("restore", snapshot);
  sh(
    `psql "$DATABASE_URL" -At -c "update transactions set deleted_at = now() where source = 'receipt' and note like 'E2E %' and deleted_at is null"`,
  );
});

test.beforeEach(async ({ context }) => {
  test.setTimeout(120_000);
  await loginAs(context);
});

test("tombol kamera di desktop membuka halaman pilih atau seret foto", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Foto struk" }).click();
  await expect(page).toHaveURL(/\/struk$/, { timeout: 30_000 });
  await expect(page.getByText("Seret foto struk ke sini")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pilih foto" })).toBeVisible();
});

test("foto struk dipecah per kategori, tersimpan, lampiran terlihat di detail", async ({ page }) => {
  await page.goto("/struk");
  await page.locator('main input[type="file"]').setInputFiles(PHOTO);

  await expect(page).toHaveURL(/lampiran=/, { timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Foto struk" })).toBeVisible();
  const total = page.getByLabel("Total struk");
  await expect(total).toHaveValue("168.000", { timeout: 60_000 });
  await expect(page.getByLabel("Nama item 1")).toHaveValue("INDOMIE GORENG 5PCS");
  await expect(page.getByLabel("Nama item 8")).toHaveValue("HEMAT INDOMIE");
  // AI menemukan empat kategori, jadi pratinjau langsung memilih pecah per kategori
  await expect(page.getByRole("radio", { name: /Pecah per kategori/ })).toBeChecked();
  await expect(page.getByText(/Jumlah item Rp .* total struk/)).toHaveCount(0);

  // ubah total: selisih > 2% memunculkan banner, lalu dikembalikan
  await total.fill("192.000");
  await expect(page.getByText("Jumlah item Rp 168.000, total struk Rp 192.000. Cek item yang terlewat.")).toBeVisible();
  await total.fill("168.000");
  await expect(page.getByText(/Cek item yang terlewat/)).toHaveCount(0);

  const rincian = page.locator("dl").filter({ hasText: "Belanja dapur" });
  await expect(rincian).toContainText("Rp 115.300");

  await page.getByLabel("Catatan").fill("E2E Indomaret Merdeka Raya");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();

  await expect(page).toHaveURL(/\/transaksi\?id=/, { timeout: 30_000 });
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("Foto struk", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(detail.getByText("Rincian per kategori")).toBeVisible();
  await expect(detail.getByText("Rp 115.300")).toBeVisible();
  const thumb = detail.getByRole("img", { name: "Lampiran 1" });
  await expect(thumb).toBeVisible();
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});
