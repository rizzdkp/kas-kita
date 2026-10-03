import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createCategoryRow, createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { aiCalls } from "@/server/db/schema";
import { resolveQuickAddLines } from "@/server/ai/quick-add/resolve";
import { saveAiSettings } from "@/server/mutations/ai-settings";
import { getQuickAddContext } from "@/server/queries/quick-add-context";

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

// Kamis, 24 Sep 2026 09.12 WIB
const NOW = new Date("2026-09-24T09:12:00+07:00");
const LINES = ["servis motor 350rb", "iuran sampah dan keamanan seratus ribu dari rekening bersama"];

let h: Household;
let ids: { transport: string; rumah: string; bersama: string; gopay: string };
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

/** Menjalankan scripts/fake-ai-server.ts dengan env tertentu dan mengembalikan base URL-nya. */
async function startFake(env: Record<string, string> = {}): Promise<string> {
  const port = await freePort();
  // node langsung, bukan npx, supaya kill menghentikan proses server itu sendiri
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(port), ...env },
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}/v1`;
  for (let i = 0; i < 100; i++) {
    const ok = await fetch(`${base}/models`).then((r) => r.ok, () => false);
    if (ok) return base;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("fake AI server tidak jalan");
}

async function configure(baseUrl: string): Promise<void> {
  await saveAiSettings(h.rizz, { baseUrl, apiKey: "sk-tes-quick-add-9876", textModel: "fake-text", visionModel: null, version: null }, testDb);
}

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  const cats = await seedBasicCategories(testDb);
  const rumah = await createCategoryRow(testDb, { name: "Rumah", kind: "expense" });
  const bersama = await createAccountRow(testDb, { name: "Rekening Bersama", type: "bank", ownerId: null });
  const gopay = await createAccountRow(testDb, { name: "GoPay Rizz", type: "ewallet", ownerId: h.rizz.user.id });
  ids = { transport: cats.transport.id, rumah: rumah.id, bersama: bersama.id, gopay: gopay.id };
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

describe("resolveQuickAddLines terhadap server AI palsu", () => {
  it("tanpa pengaturan AI: flag konteks false dan AI tidak dipanggil", async () => {
    expect((await getQuickAddContext(h.rizz, testDb)).aiAvailable).toBe(false);
    const result = await resolveQuickAddLines(h.rizz, LINES, "me", testDb, NOW);
    expect(result).toMatchObject({ ok: false, code: "not_configured" });
    expect(await testDb.select().from(aiCalls)).toHaveLength(0);
  });

  it("memetakan fixture quick_add ke id akun dan kategori, nominal jadi bigint", async () => {
    await configure(await startFake());
    const ctx = await getQuickAddContext(h.rizz, testDb);
    expect(ctx.aiAvailable).toBe(true);
    // key dan base URL tidak pernah ikut ke konteks klien
    expect(JSON.stringify(ctx)).not.toContain("sk-tes");
    expect(JSON.stringify(ctx)).not.toContain("127.0.0.1");

    const result = await resolveQuickAddLines(h.rizz, LINES, "me", testDb, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ kind: "expense", amount: 350_000n, accountId: null, categoryId: ids.transport, occurredAt: null });
    expect(result.data[1]).toMatchObject({
      kind: "expense",
      amount: 100_000n,
      accountId: ids.bersama,
      categoryId: ids.rumah,
      recipient: "shared",
      note: "Iuran sampah dan keamanan",
    });

    const calls = await testDb.select().from(aiCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ purpose: "quick_add", model: "fake-text", ok: true });
    expect(JSON.stringify(calls[0])).not.toContain("350");
  });

  it("nama di luar daftar dan tanggal masa depan dari model menjadi kosong", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "qa-ai-"));
    writeFileSync(
      join(tempDir, "quick_add.json"),
      JSON.stringify({
        items: [
          { line: 1, kind: "expense", amount: "1,5jt", accountName: "Mandiri Rizz", toAccountName: null, categoryName: "Otomotif", date: "2026-10-01", note: null, beneficiary: null },
        ],
      }),
    );
    await configure(await startFake({ FAKE_AI_FIXTURES: tempDir }));
    const result = await resolveQuickAddLines(h.rizz, ["servis besar motor"], "me", testDb, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({ amount: 1_500_000n, accountId: null, categoryId: null, occurredAt: null });
  });

  it("server yang menolak json_schema dan json_object tetap terbaca lewat instruksi prompt", async () => {
    await configure(await startFake({ FAKE_AI_REJECT: "both" }));
    const result = await resolveQuickAddLines(h.rizz, LINES, "me", testDb, NOW);
    expect(result.ok && result.data[1]?.accountId).toBe(ids.bersama);
  });

  it("JSON rusak: gagal dengan pesan siap tampil, tanpa hasil", async () => {
    await configure(await startFake({ FAKE_AI_BROKEN: "1" }));
    const result = await resolveQuickAddLines(h.rizz, LINES, "me", testDb, NOW);
    expect(result).toMatchObject({ ok: false, code: "invalid_output" });
  });

  it("server mati: pesan COPY AI tidak bisa dihubungi", async () => {
    await configure(`http://127.0.0.1:${await freePort()}/v1`);
    const result = await resolveQuickAddLines(h.rizz, LINES, "me", testDb, NOW);
    expect(result).toEqual({
      ok: false,
      code: "unreachable",
      error: "Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri.",
    });
  });
});
