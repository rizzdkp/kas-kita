import { eq } from "drizzle-orm";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { importBatches } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { insertImportBatch, insertImportRows, markImportBatchFailed, ImportBatchNotFoundError } from "@/server/mutations/imports";
import { getCommittedRowHashes, getDedupeCandidates } from "@/server/queries/imports";
import { classifyRows, DEDUPE_WINDOW_DAYS } from "./dedupe";
import { deleteImportFile } from "./files";
import { computeRowHashes, normalizeDescription } from "./row-hash";
import { toStoredParsedRow } from "./stored-row";
import type { ImportFormat, ParsedRow } from "./types";

export { AlreadyImportedError } from "@/server/mutations/imports";

// batas jumlah baris per file supaya layar tinjau dan satu transaksi DB tetap wajar
export const MAX_IMPORT_ROWS = 5000;

export interface CreateBatchInput {
  accountId: string;
  institutionId: string | null;
  format: ImportFormat;
  fileSha256: string;
}

/** Hapus file sementara batch (helper files.ts milik parser CSV/PDF); gagal hapus tidak menggagalkan alur. */
export async function removeImportFiles(batchId: string): Promise<void> {
  // file tersisa tetap dibersihkan job harian setelah 7 hari
  await deleteImportFile(batchId).catch(() => undefined);
}

/**
 * Buat import_batches berstatus "parsing". Lempar AlreadyImportedError (DomainError "already_imported") dengan pesan COPY
 * "File ini sudah diimpor pada [tanggal]. Lihat hasil impornya." bila file_sha256 sama pernah committed.
 * Batch lama dengan file sama yang belum committed dihapus beserta file sementaranya.
 */
export async function createImportBatch(viewer: Viewer, input: CreateBatchInput, db: DbOrTx = defaultDb): Promise<{ id: string }> {
  const { id, replacedBatchIds } = await insertImportBatch(viewer, input, db);
  await Promise.all(replacedBatchIds.map(removeImportFiles));
  return { id };
}

function assertParsedRow(row: ParsedRow, index: number): void {
  const ok =
    /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    (row.time === null || /^\d{2}:\d{2}$/.test(row.time)) &&
    typeof row.amount === "bigint" &&
    row.amount !== 0n &&
    (row.balance === null || typeof row.balance === "bigint");
  if (!ok) throw new ValidationError(`Baris ${index + 1} di file belum terbaca. Cek format file lalu unggah lagi.`);
}

/** Simpan baris hasil parse (hitung row_hash), jalankan dedupe, set status batch "review". */
export async function saveParsedRows(viewer: Viewer, batchId: string, rows: ParsedRow[], db: DbOrTx = defaultDb): Promise<{ count: number }> {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(`File ini berisi lebih dari ${MAX_IMPORT_ROWS} baris. Pecah per bulan lalu impor satu per satu.`);
  }
  rows.forEach(assertParsedRow);
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId));
  if (!batch) throw new ImportBatchNotFoundError();

  const normalized = rows.map((r) => ({ date: r.date, amount: r.amount, normalizedDescription: normalizeDescription(r.description) }));
  const hashes = computeRowHashes({ institutionId: batch.institutionId, accountId: batch.accountId }, normalized);
  const committed = await getCommittedRowHashes(hashes, db);

  const dates = rows.map((r) => r.date).sort();
  const candidates =
    dates.length === 0
      ? []
      : await getDedupeCandidates(
          viewer,
          { accountId: batch.accountId, from: dates[0]!, to: dates[dates.length - 1]!, windowDays: DEDUPE_WINDOW_DAYS },
          db,
        );
  const groups = classifyRows(
    rows.map((r, i) => ({ rowHash: hashes[i]!, date: r.date, amount: r.amount })),
    committed,
    candidates,
  );

  return insertImportRows(
    viewer,
    batchId,
    rows.map((r, i) => ({
      rowHash: hashes[i]!,
      raw: r.raw,
      parsed: toStoredParsedRow(r, i, normalized[i]!.normalizedDescription, groups[i]!),
      matchedTransactionId: groups[i]!.matchedTransactionId,
    })),
    db,
  );
}

/** Tandai batch gagal dengan pesan siap tampil (tanpa nominal atau password); file sementara ikut dihapus. */
export async function failImportBatch(viewer: Viewer, batchId: string, message: string, db: DbOrTx = defaultDb): Promise<void> {
  await markImportBatchFailed(viewer, batchId, message, db);
  await removeImportFiles(batchId);
}
