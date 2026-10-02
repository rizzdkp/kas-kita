import { createHash } from "node:crypto";
import { z } from "zod";
import { getAiConfig } from "@/server/ai/client";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { looksLikePdf, PDF_MAX_BYTES } from "./extract-text";
import { PDF_MESSAGES } from "./messages";

export interface PdfUploadInput {
  accountId: string;
  file: { bytes: Uint8Array; name: string };
  password?: string;
}

const accountIdSchema = z.uuid();

/** Ukuran, magic bytes, dan akun; lempar DomainError dengan pesan siap tampil. */
export function assertPdfFile(input: PdfUploadInput): void {
  if (!accountIdSchema.safeParse(input.accountId).success) throw new DomainError("validation", "Pilih akun tujuan impor.");
  const { bytes } = input.file;
  if (bytes.byteLength === 0) throw new DomainError("pdf_empty", PDF_MESSAGES.empty);
  if (bytes.byteLength > PDF_MAX_BYTES) throw new DomainError("pdf_too_large", PDF_MESSAGES.tooLarge);
  if (!looksLikePdf(bytes)) throw new DomainError("not_pdf", PDF_MESSAGES.notPdf);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** AI ditawarkan hanya kalau base URL, key, dan model teks sudah dipasang. */
export async function isPdfAiAvailable(db: DbOrTx = defaultDb): Promise<boolean> {
  const config = await getAiConfig(db).catch(() => null);
  return Boolean(config?.textModel);
}
