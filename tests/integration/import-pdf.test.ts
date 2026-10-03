import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, type Household } from "../helpers/fixtures";
import { CONTOH_BANK_PASSWORD } from "../fixtures/statements/generate";
import { importBatches, importRows, institutions } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { handlePdfUpload } from "@/server/import/pdf/handle-upload";
import { PDF_MESSAGES } from "@/server/import/pdf/messages";
import { contohBankParser } from "@/server/import/pdf/parsers/contoh-bank";
import type { StatementParser } from "@/server/import/pdf/types";
import { saveAiSettings } from "@/server/mutations/ai-settings";

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const dir = join(process.cwd(), "tests/fixtures/statements");
const file = (name: string) => ({ bytes: new Uint8Array(readFileSync(join(dir, name))), name: name.split("/").pop()! });

let h: Household;
let accountId: string;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  accountId = (await createAccountRow(testDb, { name: "Bank Contoh Rizz", type: "bank", ownerId: h.rizz.user.id })).id;
});

afterAll(async () => {
  await closeDb();
});

async function rowsOf(batchId: string) {
  return testDb.select().from(importRows).where(eq(importRows.batchId, batchId)).orderBy(asc(importRows.createdAt), asc(importRows.id));
}

describe("handlePdfUpload: parser dikenali", () => {
  it("PDF contoh-bank menjadi batch pdf berstatus review dengan 13 baris dan institusi dari slug", async () => {
    const [inst] = await testDb.insert(institutions).values({ name: "Bank Contoh", slug: "contoh-bank", kind: "bank" }).returning();
    const out = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus.pdf") }, { db: testDb });
    expect(out.status).toBe("review");
    if (out.status !== "review") return;
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch).toMatchObject({ format: "pdf", status: "review", institutionId: inst!.id, accountId, createdBy: h.rizz.user.id });
    expect(batch!.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    const rows = await rowsOf(out.batchId);
    expect(rows).toHaveLength(13);
    expect(rows.some((r) => (r.raw as Record<string, string>).__balanceMismatch === "1")).toBe(false);
  });

  it("saldo tidak cocok: batch tetap review, baris yang tidak cocok ditandai raw.__balanceMismatch", async () => {
    const out = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus-saldo-selisih.pdf") }, { db: testDb });
    if (out.status !== "review") throw new Error(out.status);
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, out.batchId));
    expect(batch!.status).toBe("review");
    expect(batch!.institutionId).toBeNull();
    const flagged = (await rowsOf(out.batchId)).filter((r) => (r.raw as Record<string, string>).__balanceMismatch === "1");
    expect(flagged.map((r) => (r.raw as Record<string, string>).keterangan).sort()).toEqual(["BELANJA SUPERMARKET CONTOH", "TRANSFER MASUK DARI PARTNER"]);
  });
});

describe("handlePdfUpload: password (F-IN-5 AC2)", () => {
  it("tanpa password minta password, password salah ditandai, password benar lanjut ke review", async () => {
    const locked = file("contoh-bank/mutasi-agustus-berpassword.pdf");
    expect(await handlePdfUpload(h.rizz, { accountId, file: locked }, { db: testDb })).toEqual({ status: "needs_password", wrongPassword: false });
    expect(await handlePdfUpload(h.rizz, { accountId, file: locked, password: "salah" }, { db: testDb })).toEqual({
      status: "needs_password",
      wrongPassword: true,
    });
    const ok = await handlePdfUpload(h.rizz, { accountId, file: locked, password: CONTOH_BANK_PASSWORD }, { db: testDb });
    expect(ok.status).toBe("review");
  });

  it("password tidak pernah tersimpan di database maupun log", async () => {
    const log = vi.spyOn(console, "log");
    const err = vi.spyOn(console, "error");
    const out = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus-berpassword.pdf"), password: CONTOH_BANK_PASSWORD }, { db: testDb });
    if (out.status !== "review") throw new Error(out.status);
    const dump = JSON.stringify(await testDb.select().from(importBatches)) + JSON.stringify(await rowsOf(out.batchId));
    const logged = JSON.stringify([...log.mock.calls, ...err.mock.calls]);
    expect(dump).not.toContain(CONTOH_BANK_PASSWORD);
    expect(logged).not.toContain(CONTOH_BANK_PASSWORD);
    log.mockRestore();
    err.mockRestore();
  });
});

describe("handlePdfUpload: tidak dikenali (F-IN-5 AC3)", () => {
  it("tanpa AI terpasang: unrecognized tanpa tawaran AI dan tanpa batch", async () => {
    const out = await handlePdfUpload(h.rizz, { accountId, file: file("tidak-dikenal/dompet-contoh.pdf") }, { db: testDb });
    expect(out).toEqual({ status: "unrecognized", offerAi: false });
    expect(await testDb.select().from(importBatches)).toHaveLength(0);
  });

  it("dengan model teks terpasang: AI ditawarkan", async () => {
    await saveAiSettings(h.rizz, { baseUrl: "http://127.0.0.1:9/v1", apiKey: "sk-tes-pdf-1234", textModel: "fake-text", visionModel: null, version: null }, testDb);
    const out = await handlePdfUpload(h.rizz, { accountId, file: file("tidak-dikenal/dompet-contoh.pdf") }, { db: testDb });
    expect(out).toEqual({ status: "unrecognized", offerAi: true });
  });
});

describe("handlePdfUpload: kegagalan parser diisolasi (F-IN-5 AC4)", () => {
  it("parser lain yang melempar tidak menghalangi contoh-bank; parser yang cocok tapi gagal menjadi unrecognized", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exploding: StatementParser = {
      slug: "bank-meledak",
      canParse: () => {
        throw new Error("rusak");
      },
      parse: () => [],
    };
    const ok = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus.pdf") }, { db: testDb, parsers: [exploding, contohBankParser] });
    expect(ok.status).toBe("review");

    const failing: StatementParser = { ...contohBankParser, slug: "contoh-bank-rusak", parse: () => { throw new Error("rusak"); } };
    const bad = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus.pdf") }, { db: testDb, parsers: [failing] });
    expect(bad).toEqual({ status: "unrecognized", offerAi: false });
    vi.restoreAllMocks();
  });
});

describe("handlePdfUpload: validasi file", () => {
  const expectCode = async (bytes: Uint8Array, code: string, message: string) => {
    const err = await handlePdfUpload(h.rizz, { accountId, file: { bytes, name: "x.pdf" } }, { db: testDb }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toMatchObject({ code, message });
  };

  it("kosong, bukan PDF (magic bytes), lebih dari 20 MB, dan PDF rusak ditolak dengan pesan siap tampil", async () => {
    await expectCode(new Uint8Array(), "pdf_empty", PDF_MESSAGES.empty);
    await expectCode(new TextEncoder().encode("tanggal,keterangan\n"), "not_pdf", PDF_MESSAGES.notPdf);
    const big = new Uint8Array(20 * 1024 * 1024 + 1);
    big.set(new TextEncoder().encode("%PDF-1.4"));
    await expectCode(big, "pdf_too_large", PDF_MESSAGES.tooLarge);
    await expectCode(new TextEncoder().encode("%PDF-1.4\nrusak"), "pdf_unreadable", PDF_MESSAGES.unreadable);
  });

  it("file yang sama sudah committed: pesan sudah diimpor dari pipeline", async () => {
    const first = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus.pdf") }, { db: testDb });
    if (first.status !== "review") throw new Error(first.status);
    await testDb.update(importBatches).set({ status: "committed" }).where(eq(importBatches.id, first.batchId));
    const err = await handlePdfUpload(h.rizz, { accountId, file: file("contoh-bank/mutasi-agustus.pdf") }, { db: testDb }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "already_imported" });
  });
});
