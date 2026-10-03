import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, type Household } from "../helpers/fixtures";
import { CONTOH_BANK_PASSWORD } from "../fixtures/statements/generate";
import { AI_NOT_CONFIGURED_MESSAGE, AI_INVALID_OUTPUT_MESSAGE } from "@/server/ai/client";
import { aiCalls, importBatches, importRows } from "@/server/db/schema";
import { runPdfAiJob, startAiPdfExtraction } from "@/server/import/pdf/ai-extract";
import { PDF_MESSAGES } from "@/server/import/pdf/messages";
import type { PdfAiJobData } from "@/server/jobs/names";
import { saveAiSettings } from "@/server/mutations/ai-settings";

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

// Kamis, 24 Sep 2026 09.12 WIB
const NOW = new Date("2026-09-24T09:12:00+07:00");
const dir = join(process.cwd(), "tests/fixtures/statements");
const file = (name: string) => ({ bytes: new Uint8Array(readFileSync(join(dir, name))), name: name.split("/").pop()! });

let h: Household;
let accountId: string;
let fake: ChildProcess | null = null;

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

async function startFake(env: Record<string, string> = {}): Promise<string> {
  const port = await freePort();
  fake = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, FAKE_AI_PORT: String(port), ...env },
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}/v1`;
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${base}/models`).then((r) => r.ok, () => false)) return base;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("fake AI server tidak jalan");
}

async function configure(baseUrl: string): Promise<void> {
  await saveAiSettings(h.rizz, { baseUrl, apiKey: "sk-tes-pdf-ai-5678", textModel: "fake-text", visionModel: null, version: null }, testDb);
}

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  accountId = (await createAccountRow(testDb, { name: "Dompet Contoh", type: "ewallet", ownerId: h.nadia.user.id })).id;
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (fake) {
    const proc = fake;
    fake = null;
    await new Promise<void>((resolve) => {
      if (proc.exitCode !== null) return resolve();
      proc.once("exit", () => resolve());
      proc.kill("SIGTERM");
    });
  }
});

afterAll(async () => {
  await closeDb();
});

async function start(name = "tidak-dikenal/dompet-contoh.pdf", password?: string) {
  const sent: PdfAiJobData[] = [];
  const out = await startAiPdfExtraction(h.nadia, { accountId, file: file(name), password }, { db: testDb, enqueue: async (d) => void sent.push(d) });
  return { out, sent };
}

describe("startAiPdfExtraction", () => {
  it("AI belum dipasang: ditolak dengan pesan pengaturan AI, tanpa batch", async () => {
    await expect(start()).rejects.toMatchObject({ code: "ai_not_configured", message: AI_NOT_CONFIGURED_MESSAGE });
    expect(await testDb.select().from(importBatches)).toHaveLength(0);
  });

  it("membuat batch ai_pdf berstatus parsing dan mengirim job berisi batchId + teks per halaman saja", async () => {
    await configure("http://127.0.0.1:9/v1");
    const { out, sent } = await start();
    expect(out.status).toBe("parsing");
    if (out.status !== "parsing") return;
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch).toMatchObject({ format: "ai_pdf", status: "parsing", institutionId: null, createdBy: h.nadia.user.id });
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0]!).sort()).toEqual(["batchId", "pages"]);
    expect(sent[0]!.batchId).toBe(out.batchId);
    expect(sent[0]!.pages[0]).toContain("DOMPET CONTOH");
  });

  it("PDF berpassword: password dipakai di app, job hanya berisi teks tanpa password", async () => {
    await configure("http://127.0.0.1:9/v1");
    const noPw = await start("contoh-bank/mutasi-agustus-berpassword.pdf");
    expect(noPw.out).toEqual({ status: "needs_password", wrongPassword: false });
    const { out, sent } = await start("contoh-bank/mutasi-agustus-berpassword.pdf", CONTOH_BANK_PASSWORD);
    expect(out.status).toBe("parsing");
    expect(JSON.stringify(sent)).not.toContain(CONTOH_BANK_PASSWORD);
  });

  it("antrean gagal: batch ditandai gagal dengan pesan siap tampil", async () => {
    await configure("http://127.0.0.1:9/v1");
    const err = await startAiPdfExtraction(h.nadia, { accountId, file: file("tidak-dikenal/dompet-contoh.pdf") }, {
      db: testDb,
      enqueue: async () => {
        throw new Error("koneksi putus");
      },
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "queue_failed", message: PDF_MESSAGES.aiQueueFailed });
    const [batch] = await testDb.select().from(importBatches);
    expect(batch).toMatchObject({ status: "failed", error: PDF_MESSAGES.aiQueueFailed });
  });
});

describe("runPdfAiJob dengan server AI palsu", () => {
  it("job dijalankan langsung: baris dari model menjadi batch review, ai_calls hanya metadata", async () => {
    await configure(await startFake());
    const { out, sent } = await start();
    if (out.status !== "parsing") throw new Error(out.status);
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runPdfAiJob(sent[0]!, { db: testDb, now: NOW })).toBe("review");

    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch).toMatchObject({ status: "review", error: null, format: "ai_pdf" });
    const rows = await testDb.select().from(importRows).where(eq(importRows.batchId, out.batchId)).orderBy(asc(importRows.id));
    const raws = rows.map((r) => r.raw as Record<string, string>);
    expect(raws.map((r) => r.keterangan).sort()).toEqual(["Isi saldo dari rekening", "Kirim ke teman", "Pembayaran merchant KEDAI CONTOH"]);
    expect(raws.every((r) => r.halaman === "1")).toBe(true);

    const calls = await testDb.select().from(aiCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ purpose: "pdf_extract", model: "fake-text", ok: true });
    // log job hanya id dan hitungan
    const logged = logs.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"rows":3');
    expect(logged).not.toMatch(/KEDAI|27\.500|teman/);
  });

  it("server menolak json_schema lalu json_object: fallback prompt tetap menghasilkan review", async () => {
    await configure(await startFake({ FAKE_AI_REJECT: "both" }));
    const { sent } = await start();
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runPdfAiJob(sent[0]!, { db: testDb, now: NOW })).toBe("review");
  });

  it("JSON rusak: batch gagal dengan pesan AI", async () => {
    await configure(await startFake({ FAKE_AI_BROKEN: "1" }));
    const { out, sent } = await start();
    if (out.status !== "parsing") throw new Error(out.status);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runPdfAiJob(sent[0]!, { db: testDb, now: NOW })).toBe("failed");
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch).toMatchObject({ status: "failed", error: AI_INVALID_OUTPUT_MESSAGE });
  });

  it("semua baris ditolak (tanggal masa depan): batch gagal dengan pesan tidak ada baris", async () => {
    await configure(await startFake());
    const { out, sent } = await start();
    if (out.status !== "parsing") throw new Error(out.status);
    vi.spyOn(console, "log").mockImplementation(() => {});
    // hari ini 1 Agu 2026: semua tanggal fixture ada di masa depan
    expect(await runPdfAiJob(sent[0]!, { db: testDb, now: new Date("2026-08-01T08:00:00+07:00") })).toBe("failed");
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch!.error).toBe(PDF_MESSAGES.aiNoRows);
  });

  it("AI dicabut sebelum job jalan: batch gagal dengan pesan pengaturan AI", async () => {
    await configure("http://127.0.0.1:9/v1");
    const { out, sent } = await start();
    if (out.status !== "parsing") throw new Error(out.status);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runPdfAiJob(sent[0]!, { db: testDb, now: NOW, getConfig: async () => null })).toBe("failed");
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch!.error).toBe(AI_NOT_CONFIGURED_MESSAGE);
  });

  it("batch yang sudah dibatalkan atau bukan parsing dilewati tanpa memanggil AI", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runPdfAiJob({ batchId: "01900000-0000-7000-8000-000000000000", pages: ["x"] }, { db: testDb, now: NOW })).toBe("skipped");
    expect(await testDb.select().from(aiCalls)).toHaveLength(0);
  });
});
