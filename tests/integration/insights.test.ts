import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { aiCalls, budgets, insights } from "@/server/db/schema";
import { runWeeklyInsights } from "@/server/insights/generate";
import { getStoredInsights } from "@/server/insights/read";
import { saveAiSettings } from "@/server/mutations/ai-settings";
import { handleWeeklyInsightsJob } from "@/worker/jobs/weekly-insights";

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

// Senin 28 Sep 2026 06.00 WIB: merangkum 21-27 Sep, pembanding 24 Agu - 20 Sep
const NOW = new Date("2026-09-28T06:00:00+07:00");
const WEEK = "2026-09-21";

let h: Household;
let ids: { food: string; groceries: string; coffee: string; transport: string; gopay: string; lastWeek: string[] };
let fake: ChildProcess | null = null;
let tempDir: string | null = null;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

async function startFake(env: Record<string, string> = {}): Promise<void> {
  const port = await freePort();
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(port), ...env },
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}/v1`;
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${base}/models`).then((r) => r.ok, () => false)) {
      await saveAiSettings(h.rizz, { baseUrl: base, apiKey: "sk-tes-wawasan-1234", textModel: "fake-text", visionModel: null, version: null }, testDb);
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("fake AI server tidak jalan");
}

/**
 * Fixture Rizz (GoPay milik Rizz), dihitung manual:
 * - Makan dan minum (induk): minggu lalu Belanja dapur 200.000 + Kopi 100.000 = 300.000.
 *   4 minggu sebelumnya Belanja dapur 4 x 50.000 = 200.000, rata-rata 50.000; naik 250.000 = 500%.
 * - Transportasi: minggu lalu 80.000; sebelumnya 4 x 80.000, rata-rata 80.000; tidak naik.
 * - Anggaran wajib Makan dan minum Sep 250.000; terpakai Sep sampai saat job (28 Sep 06.00)
 *   = 3 x 50.000 + 300.000 + Kopi 999.000 Senin dini hari = 1.449.000 = 579,6%.
 * - Total minggu lalu 380.000 dari 3 transaksi.
 */
beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  const c = await seedBasicCategories(testDb);
  const gopay = await createAccountRow(testDb, { name: "GoPay Rizz", type: "ewallet", ownerId: h.rizz.user.id, openingBalance: 5_000_000n });
  const by = h.rizz.user.id;
  for (const d of ["2026-08-25", "2026-09-01", "2026-09-08", "2026-09-15"]) {
    await insertTx(testDb, { kind: "expense", amount: 50_000n, accountId: gopay.id, categoryId: c.groceries.id, occurredAt: `${d}T10:00:00+07:00`, createdBy: by });
    await insertTx(testDb, { kind: "expense", amount: 80_000n, accountId: gopay.id, categoryId: c.transport.id, occurredAt: `${d}T08:00:00+07:00`, createdBy: by });
  }
  const t1 = await insertTx(testDb, { kind: "expense", amount: 200_000n, accountId: gopay.id, categoryId: c.groceries.id, occurredAt: "2026-09-22T10:00:00+07:00", createdBy: by });
  const t2 = await insertTx(testDb, { kind: "expense", amount: 100_000n, accountId: gopay.id, categoryId: c.coffee.id, occurredAt: "2026-09-27T23:30:00+07:00", createdBy: by });
  const t3 = await insertTx(testDb, { kind: "expense", amount: 80_000n, accountId: gopay.id, categoryId: c.transport.id, occurredAt: "2026-09-21T00:10:00+07:00", createdBy: by });
  // di luar minggu: Senin 28 Sep dini hari dan draf
  await insertTx(testDb, { kind: "expense", amount: 999_000n, accountId: gopay.id, categoryId: c.coffee.id, occurredAt: "2026-09-28T00:01:00+07:00", createdBy: by });
  await insertTx(testDb, { kind: "expense", amount: 999_000n, accountId: gopay.id, categoryId: c.coffee.id, occurredAt: "2026-09-23T12:00:00+07:00", createdBy: by, status: "draft" });
  await testDb.insert(budgets).values({ scopeOwner: `user:${by}`, categoryId: c.food.id, month: "2026-09-01", amount: 250_000n, isMandatory: true });
  ids = { food: c.food.id, groceries: c.groceries.id, coffee: c.coffee.id, transport: c.transport.id, gopay: gopay.id, lastWeek: [t3.id, t1.id, t2.id] };
});

afterEach(async () => {
  if (fake) {
    const proc = fake;
    fake = null;
    await new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      proc.kill("SIGTERM");
    });
  }
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

afterAll(closeDb);

async function rowsFor(scope: string) {
  const rows = await testDb.select().from(insights).where(eq(insights.scope, scope)).orderBy(asc(insights.text));
  return rows.map((r) => ({ ...r, kind: (r.facts as { kind: string }).kind }));
}

describe("job insights.weekly tanpa AI (F-AI-2 AC1, AC3, AC4)", () => {
  it("menghitung fakta, maksimal tiga, kalimat templat, id transaksi penyusun", async () => {
    const run = await runWeeklyInsights({ now: NOW, writer: null }, testDb);
    expect(run).toMatchObject({ weekStart: WEEK, scopes: 3, insights: 6, ai: 0, template: 6 });

    const me = await rowsFor(`me:${h.rizz.user.id}`);
    expect(me.map((r) => r.kind).sort()).toEqual(["anggaran_lewat", "kategori_naik", "total_minggu"]);
    expect(me.every((r) => r.generatedBy === "template" && r.weekStart === WEEK)).toBe(true);
    const byKind = Object.fromEntries(me.map((r) => [r.kind, r]));
    expect(byKind.kategori_naik!.text).toBe("Pengeluaran Makan dan minum minggu lalu Rp 300.000, naik 500% dari rata-rata 4 minggu sebelumnya Rp 50.000 per minggu.");
    expect(byKind.kategori_naik!.sourceTransactionIds.sort()).toEqual([ids.lastWeek[1], ids.lastWeek[2]].sort());
    expect(byKind.anggaran_lewat!.text).toBe("Anggaran wajib Makan dan minum sudah lewat, terpakai 579,6%.");
    expect(byKind.anggaran_lewat!.sourceTransactionIds).toHaveLength(6);
    expect(byKind.total_minggu!.text).toBe("Total pengeluaran minggu lalu Rp 380.000 dari 3 transaksi.");
    expect(byKind.total_minggu!.sourceTransactionIds).toEqual(ids.lastWeek);

    expect(await rowsFor(`me:${h.nadia.user.id}`)).toEqual([]);
    expect((await rowsFor("all")).map((r) => r.kind).sort()).toEqual(["anggaran_lewat", "kategori_naik", "total_minggu"]);
  });

  it("diulang tidak menggandakan baris", async () => {
    await runWeeklyInsights({ now: NOW, writer: null }, testDb);
    await handleWeeklyInsightsJobWithDb();
    expect(await rowsFor(`me:${h.rizz.user.id}`)).toHaveLength(3);
  });

  it("dashboard membaca baris tersimpan dengan tautan filter per cakupan", async () => {
    await runWeeklyInsights({ now: NOW, writer: null }, testDb);
    const today = "2026-10-02";
    const mine = await getStoredInsights(h.rizz, "me", today, testDb);
    expect(mine?.map((i) => i.href)).toEqual([
      `/transaksi?kategori=${ids.food}&dari=2026-09-21&sampai=2026-09-27`,
      `/transaksi?kategori=${ids.food}&dari=2026-09-01&sampai=2026-09-28`,
      "/transaksi?jenis=expense&dari=2026-09-21&sampai=2026-09-27",
    ]);
    const asPartner = await getStoredInsights(h.nadia, "partner", today, testDb);
    expect(asPartner?.map((i) => i.text)).toEqual(mine?.map((i) => i.text));
    expect(asPartner?.[0]?.href).toContain("scope=partner");
    // Nadia belum punya baris: dashboard menghitung templat langsung
    expect(await getStoredInsights(h.nadia, "me", today, testDb)).toBeNull();
    // minggu berikutnya baris lama tidak dibaca
    expect(await getStoredInsights(h.rizz, "me", "2026-10-05", testDb)).toBeNull();
  });
});

// handler worker memakai db default; di tes DATABASE_URL sudah menunjuk DB tes
async function handleWeeklyInsightsJobWithDb() {
  return handleWeeklyInsightsJob(NOW);
}

describe("job insights.weekly dengan AI palsu (AC2)", () => {
  it("AI berhasil: kalimat AI dengan angka disisipkan kode", async () => {
    await startFake();
    const run = await runWeeklyInsights({ now: NOW }, testDb);
    expect(run.ai).toBe(6);
    const me = await rowsFor(`me:${h.rizz.user.id}`);
    expect(me.every((r) => r.generatedBy === "ai")).toBe(true);
    expect(me.map((r) => r.text)).toContain("Sepanjang minggu lalu pengeluaran tercatat Rp 380.000 dalam 3 transaksi.");
    expect(me.map((r) => r.text)).toContain("Minggu lalu pengeluaran Makan dan minum mencapai Rp 300.000, 500% di atas rata-rata mingguan sebelumnya.");
    const calls = await testDb.select().from(aiCalls).where(eq(aiCalls.purpose, "insight"));
    expect(calls.length).toBeGreaterThan(0);
  });

  it("JSON rusak: semua dari templat", async () => {
    await startFake({ FAKE_AI_BROKEN: "1" });
    const run = await runWeeklyInsights({ now: NOW }, testDb);
    expect(run).toMatchObject({ ai: 0, template: 6 });
  });

  it("server menolak json_schema lalu json_object: jalur instruksi prompt tetap dipakai", async () => {
    await startFake({ FAKE_AI_REJECT: "both" });
    const run = await runWeeklyInsights({ now: NOW }, testDb);
    expect(run.ai).toBe(6);
  });

  it("AI menulis angka atau placeholder asing: wawasan itu jatuh ke templat", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "kk-insight-"));
    writeFileSync(
      join(tempDir, "insight.json"),
      JSON.stringify({
        kalimat: [
          { id: "kategori_naik", teks: "Pengeluaran {{kategori_1}} naik 5 kali lipat jadi {{nominal_1}} ({{persen_1}})." },
          { id: "anggaran_lewat", teks: "Anggaran wajib {{kategori_1}} terpakai {{persen_1}} dari {{nominal_7}}." },
          { id: "total_minggu", teks: "Minggu lalu pengeluaran tercatat {{nominal_1}} dalam {{jumlah_1}} transaksi." },
        ],
      }),
    );
    await startFake({ FAKE_AI_FIXTURES: tempDir });
    await runWeeklyInsights({ now: NOW }, testDb);
    const me = Object.fromEntries((await rowsFor(`me:${h.rizz.user.id}`)).map((r) => [r.kind, r]));
    expect(me.kategori_naik).toMatchObject({ generatedBy: "template" });
    expect(me.kategori_naik!.text).not.toContain("5 kali");
    expect(me.anggaran_lewat).toMatchObject({ generatedBy: "template", text: "Anggaran wajib Makan dan minum sudah lewat, terpakai 579,6%." });
    expect(me.total_minggu).toMatchObject({ generatedBy: "ai", text: "Minggu lalu pengeluaran tercatat Rp 380.000 dalam 3 transaksi." });
  });
});
