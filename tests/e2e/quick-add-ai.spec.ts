import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/session";

// F-IN-2 AC2: parser lokal dulu, baris yang belum lengkap dilengkapi model teks lewat server AI palsu
// fixture: tests/fixtures/ai/quick_add.json (baris 1 servis motor, baris 2 iuran lewat Rekening Bersama)

const FAKE_PORT = Number(process.env.QUICK_ADD_AI_FAKE_PORT ?? 4012);
const BASE_URL = `http://localhost:${FAKE_PORT}/v1`;
const AI_DOWN = "Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri.";

test.describe.configure({ mode: "serial" });

function sh(command: string): string {
  return execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; ${command}`], { encoding: "utf8" }).trim();
}

function psql(query: string): string {
  return sh(`psql "$DATABASE_URL" -At -c ${JSON.stringify(query)}`);
}

function settings(...args: string[]): string {
  const out = sh(`npx tsx tests/e2e/helpers/quick-add-ai-settings.ts ${args.map((a) => JSON.stringify(a)).join(" ")}`);
  return out.split("\n").at(-1) ?? "";
}

let fake: ChildProcess | null = null;
let snapshot = "null";

async function startFake(): Promise<void> {
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(FAKE_PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${BASE_URL}/models`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("fake AI server tidak jalan");
}

async function stopFake(): Promise<void> {
  const proc = fake;
  fake = null;
  if (!proc || proc.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
  });
}

test.beforeAll(async () => {
  await startFake();
  snapshot = settings("set", BASE_URL, "fake-text");
});

test.afterAll(async () => {
  await stopFake();
  settings("restore", snapshot, BASE_URL);
  psql(`update transactions set deleted_at = now() where source = 'quick_add' and note like 'E2E %' and deleted_at is null and created_at > now() - interval '1 hour'`);
});

test.beforeEach(async ({ context }) => {
  await loginAs(context);
});

function bar(page: Page) {
  return page.getByRole("textbox", { name: "Catat transaksi" });
}

async function openApp(page: Page) {
  await page.goto("/");
  await expect(bar(page)).toBeVisible({ timeout: 60_000 });
}

/** Tahan panggilan AI (server action berisi baris mentah, bukan simpan) dan hitung jumlahnya. */
async function holdAiAction(page: Page, ms: number): Promise<{ count: () => number }> {
  let calls = 0;
  await page.route("**/*", async (route) => {
    const req = route.request();
    const body = req.method() === "POST" && req.headers()["next-action"] ? (req.postData() ?? "") : "";
    if (body.includes("E2E ") && !body.includes("clientId")) {
      calls += 1;
      await new Promise((r) => setTimeout(r, ms));
    }
    await route.continue().catch(() => {});
  });
  return { count: () => calls };
}

async function typeLines(page: Page, lines: string[]) {
  await bar(page).click();
  for (const [i, line] of lines.entries()) {
    if (i > 0) await page.keyboard.press("Shift+Enter");
    await page.keyboard.type(line);
  }
  await page.keyboard.press("Enter");
}

const LINES = ["E2E servis motor 350rb", "E2E iuran sampah dan keamanan seratus ribu dari rekening bersama"];

test("baris yang belum lengkap: spinner, kartu terisi AI dengan tanda, lalu simpan sebagai quick_add", async ({ page }) => {
  await openApp(page);
  const actions = await holdAiAction(page, 1500);
  await typeLines(page, LINES);

  await expect(page.getByTestId("quick-add-ai-status")).toContainText("Model AI membaca 2 baris yang belum lengkap.");
  await expect(bar(page)).toBeDisabled();

  const cards = page.getByTestId("quick-add-card");
  await expect(cards).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByTestId("quick-add-ai-status")).toHaveCount(0);

  const first = cards.nth(0);
  await expect(first.getByRole("button", { name: /Nominal/ })).toContainText("Rp 350.000");
  await expect(first.getByRole("combobox", { name: "Kategori" })).toHaveAttribute("data-ai", "true");
  await expect(first.getByRole("combobox", { name: "Kategori" })).toContainText("Transportasi");
  // nominal dari parser tidak ditandai AI
  await expect(first.getByRole("button", { name: /Nominal/ })).not.toHaveAttribute("data-ai", "true");

  const second = cards.nth(1);
  await expect(second.getByRole("button", { name: /Nominal/ })).toContainText("Rp 100.000");
  await expect(second.getByRole("button", { name: /Nominal/ })).toHaveAttribute("data-ai", "true");
  await expect(second.getByRole("combobox", { name: "Akun" })).toContainText("Rekening Bersama");
  await expect(second.getByRole("combobox", { name: "Kategori" })).toContainText("Rumah");
  await expect(page.getByText("Field bertanda AI diisi model AI. Cek sebelum menyimpan.")).toBeVisible();

  // tidak ada simpan otomatis
  expect(psql(`select count(*) from transactions where note like 'E2E iuran sampah%' and deleted_at is null and created_at > now() - interval '5 minutes'`)).toBe("0");
  expect(actions.count()).toBe(1);

  await page.getByRole("button", { name: "Simpan semua" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible({ timeout: 20_000 });
  const rows = psql(
    `select amount, source, beneficiary from transactions where note like 'E2E %' and deleted_at is null and created_at > now() - interval '5 minutes' order by amount`,
  );
  expect(rows.split("\n")).toEqual(["100000|quick_add|shared", "350000|quick_add|owner"]);
});

test("baris lengkap tidak memanggil AI (AC1)", async ({ page }) => {
  await openApp(page);
  const actions = await holdAiAction(page, 0);
  await typeLines(page, ["E2E kopi 25rb gopay"]);
  await expect(page.getByTestId("quick-add-card")).toHaveCount(1);
  await expect(page.getByText("Field bertanda AI")).toHaveCount(0);
  expect(actions.count()).toBe(0);
  await page.keyboard.press("Escape");
});

test("Esc saat AI membaca: kartu tampil tanpa hasil AI, field kosong ditandai", async ({ page }) => {
  await openApp(page);
  await holdAiAction(page, 10_000);
  await typeLines(page, [LINES[0]!]);
  await expect(page.getByTestId("quick-add-ai-status")).toBeVisible();
  await page.keyboard.press("Escape");
  const card = page.getByTestId("quick-add-card");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("combobox", { name: "Kategori" })).toHaveText("Pilih kategori");
  await expect(page.getByTestId("quick-add-ai-notice")).toHaveCount(0);
});

test("server AI mati: pesan COPY dan field kosong tetap ditandai", async ({ page }) => {
  await stopFake();
  await openApp(page);
  await typeLines(page, [LINES[0]!]);
  await expect(page.getByTestId("quick-add-ai-notice")).toHaveText(AI_DOWN, { timeout: 40_000 });
  const card = page.getByTestId("quick-add-card");
  await expect(card.getByRole("combobox", { name: "Kategori" })).toHaveText("Pilih kategori");
  await expect(page.getByRole("button", { name: "Simpan", exact: true })).toHaveAttribute("aria-disabled", "true");
});
