import type { Viewer } from "@/server/auth/viewer";
import { UploadError } from "@/server/attachments/image";
import { looksLikeText } from "@/server/import/csv/encoding";
import { assertImportAccount, handleCsvUpload } from "@/server/import/csv/upload";
import { handlePdfUpload, startAiPdfExtraction } from "@/server/import/pdf/handle-upload";
import { getAccount } from "@/server/queries/accounts";

// SECURITY.md: batas unggah mutasi 20 MB
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

export const IMPORT_UPLOAD_MESSAGES = {
  tooLarge: "File lebih dari 20 MB. Unduh mutasi per bulan lalu unggah satu per satu.",
  empty: "File kosong. Pilih file CSV atau PDF mutasi dari bank.",
  noAccount: "Pilih akun tujuan dulu.",
  notSupported: "File ini bukan CSV atau PDF. Pilih file mutasi dari bank.",
  excel: "File Excel belum bisa dibaca. Simpan sebagai CSV dari Excel lalu unggah lagi.",
  unrecognized: "Format mutasi ini belum dikenali. Coba impor CSV, atau baca dengan AI dan cek hasilnya baris per baris.",
  unrecognizedNoAi: "Format mutasi ini belum dikenali. Coba impor CSV, atau pasang model AI di Pengaturan supaya PDF ini bisa dibaca dengan AI.",
} as const;

export type ImportFileKind = "csv" | "pdf" | "excel" | "unknown";

export type ImportUploadResponse =
  | { status: "review" | "parsing" | "mapping"; batchId: string; next: string }
  | { status: "needs_password"; wrongPassword: boolean }
  | { status: "unrecognized"; offerAi: boolean; error: string };

/** Jenis file dari isi (magic bytes), bukan dari ekstensi atau Content-Type kiriman browser. */
export function sniffImportFile(bytes: Uint8Array): ImportFileKind {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  // spesifikasi PDF membolehkan byte sampah sebelum %PDF- di 1024 byte pertama
  if (head.includes("%PDF-")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "excel";
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "excel";
  return looksLikeText(bytes) ? "csv" : "unknown";
}

export interface ImportFileInput {
  accountId: string;
  name: string;
  bytes: Uint8Array;
  password?: string;
  readWithAi?: boolean;
}

function next(status: "review" | "parsing" | "mapping", batchId: string): ImportUploadResponse {
  return { status, batchId, next: status === "mapping" ? `/impor/${batchId}/pemetaan` : `/impor/${batchId}` };
}

/** Arahkan file ke impor CSV atau impor PDF (agen PDF) setelah akun tujuan divalidasi. */
export async function handleImportFile(viewer: Viewer, input: ImportFileInput): Promise<ImportUploadResponse> {
  if (input.bytes.byteLength > IMPORT_MAX_BYTES) throw new UploadError(413, IMPORT_UPLOAD_MESSAGES.tooLarge);
  const kind = sniffImportFile(input.bytes);
  if (kind === "excel") throw new UploadError(415, IMPORT_UPLOAD_MESSAGES.excel);
  if (kind === "unknown") throw new UploadError(415, IMPORT_UPLOAD_MESSAGES.notSupported);
  assertImportAccount(await getAccount(input.accountId));

  if (kind === "csv") {
    const result = await handleCsvUpload(viewer, { accountId: input.accountId, bytes: input.bytes });
    return next(result.status, result.batchId);
  }
  const pdfInput = { accountId: input.accountId, file: { bytes: input.bytes, name: input.name }, password: input.password };
  const result = input.readWithAi ? await startAiPdfExtraction(viewer, pdfInput) : await handlePdfUpload(viewer, pdfInput);
  if (result.status === "needs_password") return result;
  if (result.status === "unrecognized") {
    return { status: "unrecognized", offerAi: result.offerAi, error: result.offerAi ? IMPORT_UPLOAD_MESSAGES.unrecognized : IMPORT_UPLOAD_MESSAGES.unrecognizedNoAi };
  }
  return next(result.status, result.batchId);
}
