import type { Viewer } from "@/server/auth/viewer";
import type { DbOrTx } from "@/server/db/client";
import type { ImportFormat, ParsedRow } from "./types";

// KONTRAK SEMENTARA: agen "dedupe dan tinjau" mengganti isi file ini. Signature publik tidak boleh berubah
// tanpa memberi tahu koordinator; parser CSV dan PDF memanggil fungsi-fungsi ini.

export interface CreateBatchInput {
  accountId: string;
  institutionId: string | null;
  format: ImportFormat;
  fileSha256: string;
}

/**
 * Buat import_batches berstatus "parsing". Lempar DomainError "already_imported" dengan pesan COPY
 * "File ini sudah diimpor pada [tanggal]. Lihat hasil impornya." bila file_sha256 sama pernah committed.
 */
export async function createImportBatch(_viewer: Viewer, _input: CreateBatchInput, _db?: DbOrTx): Promise<{ id: string }> {
  throw new Error("createImportBatch belum diimplementasikan");
}

/** Simpan baris hasil parse (hitung row_hash), jalankan dedupe, set status batch "review". */
export async function saveParsedRows(_viewer: Viewer, _batchId: string, _rows: ParsedRow[], _db?: DbOrTx): Promise<{ count: number }> {
  throw new Error("saveParsedRows belum diimplementasikan");
}

/** Tandai batch gagal dengan pesan siap tampil (tanpa nominal atau password). */
export async function failImportBatch(_viewer: Viewer, _batchId: string, _message: string, _db?: DbOrTx): Promise<void> {
  throw new Error("failImportBatch belum diimplementasikan");
}
