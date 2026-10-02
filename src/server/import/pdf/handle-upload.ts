import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { listInstitutions } from "@/server/queries/accounts";
import { createImportBatch, failImportBatch, saveParsedRows } from "../pipeline";
import { extractPdfText } from "./extract-text";
import { PDF_MESSAGES } from "./messages";
import { parseStatement } from "./registry";
import { assertPdfFile, isPdfAiAvailable, sha256Hex, type PdfUploadInput } from "./shared";
import type { StatementParser } from "./types";
import { markBalanceMismatches } from "./verify-balance";

// Kontrak dipakai route unggah /impor. Password hanya hidup di memori selama request ini.

export type PdfUploadResult =
  | { status: "review" | "parsing"; batchId: string }
  | { status: "needs_password"; wrongPassword: boolean }
  | { status: "unrecognized"; offerAi: boolean; batchId?: string };

export interface PdfUploadDeps {
  db?: DbOrTx;
  parsers?: ReadonlyArray<StatementParser>;
}

async function institutionIdFor(slug: string, db: DbOrTx): Promise<string | null> {
  const list = await listInstitutions(db);
  return list.find((i) => i.slug === slug)?.id ?? null;
}

/**
 * Impor PDF F-IN-5: ekstrak teks (dengan password bila ada), cari parser institusi, simpan baris ke batch
 * berstatus review. Parser tidak ada atau gagal: "unrecognized" dengan tawaran AI bila AI terpasang.
 */
export async function handlePdfUpload(viewer: Viewer, input: PdfUploadInput, deps: PdfUploadDeps = {}): Promise<PdfUploadResult> {
  const db = deps.db ?? defaultDb;
  assertPdfFile(input);
  const password = input.password === "" ? undefined : input.password;
  const extracted = await extractPdfText(input.file.bytes, password);
  if (extracted.kind === "needs_password") return { status: "needs_password", wrongPassword: extracted.wrongPassword };
  if (extracted.kind === "invalid") throw new DomainError("pdf_unreadable", PDF_MESSAGES.unreadable);

  const outcome = parseStatement(extracted.pages, deps.parsers);
  if (outcome.kind !== "parsed") return { status: "unrecognized", offerAi: await isPdfAiAvailable(db) };

  const { rows } = markBalanceMismatches(outcome.rows);
  const batch = await createImportBatch(
    viewer,
    { accountId: input.accountId, institutionId: await institutionIdFor(outcome.slug, db), format: "pdf", fileSha256: sha256Hex(input.file.bytes) },
    db,
  );
  try {
    await saveParsedRows(viewer, batch.id, rows, db);
  } catch (e) {
    // batch tidak boleh tertinggal "parsing" selamanya; pesan DomainError sudah siap tampil
    await failImportBatch(viewer, batch.id, e instanceof DomainError ? e.message : PDF_MESSAGES.unreadable, db).catch(() => {});
    throw e;
  }
  return { status: "review", batchId: batch.id };
}

export { startAiPdfExtraction } from "./ai-extract";
export type { PdfUploadInput } from "./shared";
