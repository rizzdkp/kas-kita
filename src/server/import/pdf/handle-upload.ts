import type { Viewer } from "@/server/auth/viewer";

// KONTRAK: dipakai route unggah /impor (agen CSV). Isi sedang ditulis agen impor PDF.

export interface PdfUploadInput {
  accountId: string;
  file: { bytes: Uint8Array; name: string };
  password?: string;
}

export type PdfUploadResult =
  | { status: "review" | "parsing"; batchId: string }
  | { status: "needs_password"; wrongPassword: boolean }
  | { status: "unrecognized"; offerAi: boolean; batchId?: string };

export async function handlePdfUpload(_viewer: Viewer, _input: PdfUploadInput): Promise<PdfUploadResult> {
  return { status: "unrecognized", offerAi: false };
}

export async function startAiPdfExtraction(_viewer: Viewer, _input: PdfUploadInput): Promise<{ batchId: string }> {
  throw new Error("startAiPdfExtraction belum diimplementasikan");
}
