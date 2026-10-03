import { eq } from "drizzle-orm";
import { todayJakarta } from "@/lib/dates";
import type { Viewer } from "@/server/auth/viewer";
import { AI_NOT_CONFIGURED_MESSAGE, completeStructured, getAiConfig } from "@/server/ai/client";
import { buildPdfExtractPrompt } from "@/server/ai/prompts/pdf-extract-v1";
import {
  normalizePdfAiRows,
  PDF_EXTRACT_SCHEMA_NAME,
  pdfExtractAiJsonSchema,
  pdfExtractAiSchema,
} from "@/server/ai/schemas/pdf-extract";
import type { AiConfig } from "@/server/ai/types";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { importBatches } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import type { PdfAiJobData } from "@/server/jobs/names";
import { loadViewerForUser } from "@/server/jobs/viewer";
import { createImportBatch, failImportBatch, saveParsedRows } from "../pipeline";
import type { ParsedRow } from "../types";
import { chunkPages } from "./chunk-pages";
import { extractPdfText } from "./extract-text";
import { PDF_MESSAGES } from "./messages";
import { assertPdfFile, isPdfAiAvailable, sha256Hex, type PdfUploadInput } from "./shared";
import { markBalanceMismatches } from "./verify-balance";

export const PDF_AI_MAX_PAGES = 30;

export type StartAiPdfResult = { status: "parsing"; batchId: string } | { status: "needs_password"; wrongPassword: boolean };

export interface StartAiPdfDeps {
  db?: DbOrTx;
  enqueue?: (data: PdfAiJobData) => Promise<void>;
}

async function defaultEnqueue(data: PdfAiJobData): Promise<void> {
  // dimuat saat dipakai supaya modul ini bisa dites tanpa koneksi pg-boss
  const { enqueuePdfAi } = await import("@/server/jobs/queue");
  await enqueuePdfAi(data);
}

/**
 * "Baca dengan AI" (F-IN-5 AC3): ekstrak teks di app, buat batch ai_pdf berstatus parsing, lalu kirim
 * teks per halaman ke worker. File dan password tidak pernah masuk job.
 */
export async function startAiPdfExtraction(viewer: Viewer, input: PdfUploadInput, deps: StartAiPdfDeps = {}): Promise<StartAiPdfResult> {
  const db = deps.db ?? defaultDb;
  assertPdfFile(input);
  if (!(await isPdfAiAvailable(db))) throw new DomainError("ai_not_configured", AI_NOT_CONFIGURED_MESSAGE);
  const password = input.password === "" ? undefined : input.password;
  const extracted = await extractPdfText(input.file.bytes, password);
  if (extracted.kind === "needs_password") return { status: "needs_password", wrongPassword: extracted.wrongPassword };
  if (extracted.kind === "invalid") throw new DomainError("pdf_unreadable", PDF_MESSAGES.unreadable);
  if (extracted.pages.length > PDF_AI_MAX_PAGES) throw new DomainError("pdf_too_many_pages", PDF_MESSAGES.tooManyPages);
  if (extracted.pages.every((p) => p.trim() === "")) throw new DomainError("pdf_no_text", PDF_MESSAGES.noText);

  const batch = await createImportBatch(
    viewer,
    { accountId: input.accountId, institutionId: null, format: "ai_pdf", fileSha256: sha256Hex(input.file.bytes) },
    db,
  );
  try {
    await (deps.enqueue ?? defaultEnqueue)({ batchId: batch.id, pages: extracted.pages });
  } catch {
    await failImportBatch(viewer, batch.id, PDF_MESSAGES.aiQueueFailed, db).catch(() => {});
    throw new DomainError("queue_failed", PDF_MESSAGES.aiQueueFailed);
  }
  return { status: "parsing", batchId: batch.id };
}

export interface PdfAiJobDeps {
  db?: DbOrTx;
  now?: Date;
  getConfig?: (db: DbOrTx) => Promise<AiConfig | null>;
}

export type PdfAiJobOutcome = "review" | "failed" | "skipped";

function logJob(batchId: string, outcome: PdfAiJobOutcome, extra: Record<string, number | string> = {}): void {
  // hanya id, hasil, dan hitungan; isi mutasi tidak pernah dicatat
  console.log(JSON.stringify({ level: "info", msg: "pdf_ai_job", batchId, outcome, ...extra }));
}

/** Handler job import.pdf-ai: panggil model teks per potongan, validasi, simpan baris ke batch. */
export async function runPdfAiJob(data: PdfAiJobData, deps: PdfAiJobDeps = {}): Promise<PdfAiJobOutcome> {
  const db = deps.db ?? defaultDb;
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, data.batchId));
  if (!batch || batch.status !== "parsing" || batch.format !== "ai_pdf") {
    logJob(data.batchId, "skipped");
    return "skipped";
  }
  const viewer = await loadViewerForUser(batch.createdBy, db);
  if (!viewer) {
    logJob(data.batchId, "skipped");
    return "skipped";
  }
  const fail = async (message: string, reason: string): Promise<PdfAiJobOutcome> => {
    await failImportBatch(viewer, batch.id, message, db);
    logJob(batch.id, "failed", { reason });
    return "failed";
  };

  const config = await (deps.getConfig ?? getAiConfig)(db).catch(() => null);
  if (!config?.textModel) return fail(AI_NOT_CONFIGURED_MESSAGE, "not_configured");

  const today = todayJakarta(deps.now ?? new Date());
  const chunks = chunkPages(data.pages.slice(0, PDF_AI_MAX_PAGES));
  const rows: ParsedRow[] = [];
  let rejected = 0;
  for (const chunk of chunks) {
    const prompt = buildPdfExtractPrompt({ today, pageText: chunk.text, page: chunk.page, pageCount: data.pages.length });
    const result = await completeStructured(
      config,
      {
        purpose: "pdf_extract",
        kind: "text",
        system: prompt.system,
        user: prompt.user,
        schemaName: PDF_EXTRACT_SCHEMA_NAME,
        schema: pdfExtractAiSchema,
        jsonSchema: pdfExtractAiJsonSchema,
      },
      db,
    );
    if (!result.ok) return fail(result.error.message, result.error.code);
    const normalized = normalizePdfAiRows(result.data, { today, page: chunk.page });
    rows.push(...normalized.rows);
    rejected += normalized.rejected;
  }
  if (rows.length === 0) return fail(PDF_MESSAGES.aiNoRows, "no_rows");

  const marked = markBalanceMismatches(rows);
  try {
    await saveParsedRows(viewer, batch.id, marked.rows, db);
  } catch (e) {
    if (e instanceof DomainError && e.code !== "validation") {
      // batch dibatalkan atau sudah disimpan saat model bekerja
      logJob(batch.id, "skipped", { reason: e.code });
      return "skipped";
    }
    return fail(e instanceof DomainError ? e.message : PDF_MESSAGES.aiNoRows, "save_failed");
  }
  logJob(batch.id, "review", { rows: rows.length, rejected, mismatches: marked.mismatches, calls: chunks.length });
  return "review";
}
