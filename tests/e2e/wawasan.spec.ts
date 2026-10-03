import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/session";

// F-AI-2: job insights.weekly dengan server AI palsu (tests/fixtures/ai/insight.json); angka disisipkan kode
// spesifikasi AI: masuk AI_SPECS (berbagi baris ai_settings)

const FAKE_PORT = Number(process.env.INSIGHT_AI_FAKE_PORT ?? 4015);
const BASE_URL = `http://localhost:${FAKE_PORT}/v1`;

test.describe.configure({ mode: "serial" });

function sh(command: string): string {
  return execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; ${command}`], { encoding: "utf8" }).trim();
}

function job(command: "run" | "clear"): Record<string, number | string> {
  const line = sh(`npx tsx tests/e2e/helpers/insights-job.ts ${command}`).split("\n").at(-1) ?? "{}";
  return JSON.parse(line) as Record<string, number | string>;
}

let fake: ChildProcess | null = null;

test.beforeAll(async () => {
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(FAKE_PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${BASE_URL}/models`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  sh(`npx tsx tests/e2e/helpers/quick-add-ai-settings.ts set ${JSON.stringify(BASE_URL)} fake-text`);
});

test.afterAll(async () => {
  // dashboard kembali ke templat langsung untuk tes lain
  job("clear");
  const proc = fake;
  fake = null;
  if (proc && proc.exitCode === null) {
    await new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      proc.kill("SIGTERM");
    });
  }
});

test("wawasan dari job tampil di Ringkasan dengan angka dari kode dan tautan ke transaksi", async ({ context, page }) => {
  test.setTimeout(180_000);
  const run = job("run");
  expect(Number(run.ai)).toBeGreaterThan(0);

  await loginAs(context);
  await page.goto("/");
  const section = page.getByRole("region", { name: "Wawasan minggu ini" });
  await expect(section).toBeVisible({ timeout: 60_000 });

  // kalimat fixture AI dengan nominal dan jumlah yang disisipkan kode
  const total = section.getByText(/^Sepanjang minggu lalu pengeluaran tercatat Rp [\d.]+ dalam [\d.]+ transaksi\.$/);
  await expect(total).toBeVisible();
  const items = section.getByRole("listitem");
  expect(await items.count()).toBeLessThanOrEqual(3);
  await expect(section.getByText(/AI/)).toHaveCount(0);

  const link = section.getByRole("listitem").filter({ has: total }).getByRole("link", { name: "Lihat transaksi" });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/transaksi\?jenis=expense&dari=\d{4}-\d{2}-\d{2}&sampai=\d{4}-\d{2}-\d{2}$/);
  await link.click();
  await expect(page).toHaveURL(/\/transaksi\?jenis=expense/);
});
