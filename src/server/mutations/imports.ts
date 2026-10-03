import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { formatDateWithYear } from "@/lib/dates";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { accounts, importBatches, importRows, institutions } from "@/server/db/schema";
import { DomainError, ValidationError } from "@/server/errors";
import type { ImportFormat } from "@/server/import/types";
import { inTransaction, parseInput } from "./_shared";

export type ImportBatchRow = typeof importBatches.$inferSelect;
export type ImportRowRecord = typeof importRows.$inferSelect;

/** File yang sama sudah pernah di-commit; batchId untuk tautan "Lihat hasil impornya". */
export class AlreadyImportedError extends DomainError {
  readonly batchId: string;
  readonly committedAt: Date;
  constructor(batchId: string, committedAt: Date) {
    super("already_imported", `File ini sudah diimpor pada ${formatDateWithYear(committedAt)}. Lihat hasil impornya.`);
    this.name = "AlreadyImportedError";
    this.batchId = batchId;
    this.committedAt = committedAt;
  }
}

export class ImportBatchNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Impor ini tidak ditemukan, mungkin sudah dibatalkan. Unggah file mutasi lagi.");
    this.name = "ImportBatchNotFoundError";
  }
}

const createBatchSchema = z.object({
  accountId: z.uuid(),
  institutionId: z.uuid().nullable(),
  format: z.enum(["csv", "pdf", "ai_pdf"]),
  fileSha256: z.string().regex(/^[0-9a-f]{64}$/, "Sidik file tidak valid"),
});

export interface InsertBatchInput {
  accountId: string;
  institutionId: string | null;
  format: ImportFormat;
  fileSha256: string;
}

/**
 * Buat batch "parsing". File yang sama dari batch belum committed (gagal atau ditinggal di tinjau)
 * dihapus supaya pengguna bisa mengunggah ulang; id batch lama dikembalikan untuk membersihkan file sementara.
 */
export async function insertImportBatch(
  viewer: Viewer,
  input: InsertBatchInput,
  db: DbOrTx = defaultDb,
): Promise<{ id: string; replacedBatchIds: string[] }> {
  const data = parseInput(createBatchSchema, input);
  return inTransaction(db, async (tx) => {
    const [account] = await tx.select({ id: accounts.id, deletedAt: accounts.deletedAt }).from(accounts).where(eq(accounts.id, data.accountId));
    if (!account || account.deletedAt) throw new ValidationError("Akun tidak ditemukan. Pilih akun lain.", { accountId: ["Akun tidak ditemukan"] });
    if (data.institutionId) {
      const [inst] = await tx.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, data.institutionId));
      if (!inst) throw new ValidationError("Institusi tidak ditemukan", { institutionId: ["Institusi tidak ditemukan"] });
    }
    const same = await tx
      .select({ id: importBatches.id, status: importBatches.status, updatedAt: importBatches.updatedAt })
      .from(importBatches)
      .where(eq(importBatches.fileSha256, data.fileSha256))
      .for("update");
    const committed = same.find((b) => b.status === "committed");
    if (committed) throw new AlreadyImportedError(committed.id, committed.updatedAt);
    const replacedBatchIds = same.map((b) => b.id);
    if (replacedBatchIds.length > 0) await tx.delete(importBatches).where(inArray(importBatches.id, replacedBatchIds));
    const [row] = await tx
      .insert(importBatches)
      .values({ ...data, status: "parsing", createdBy: viewer.user.id })
      .returning({ id: importBatches.id });
    return { id: row!.id, replacedBatchIds };
  });
}

export async function lockBatch(tx: Tx, batchId: string): Promise<ImportBatchRow> {
  const [batch] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).for("update");
  if (!batch) throw new ImportBatchNotFoundError();
  return batch;
}

function assertOpen(batch: ImportBatchRow): void {
  if (batch.status === "committed") throw new DomainError("import_committed", "Impor ini sudah disimpan. Lihat hasilnya di daftar transaksi.");
}

export interface PreparedImportRow {
  rowHash: string;
  raw: Record<string, string>;
  parsed: Record<string, unknown>;
  matchedTransactionId: string | null;
}

/** Simpan baris hasil parse dan dedupe, lalu batch siap ditinjau. Pemanggilan ulang mengganti baris lama. */
export async function insertImportRows(
  viewer: Viewer,
  batchId: string,
  rows: PreparedImportRow[],
  db: DbOrTx = defaultDb,
): Promise<{ count: number }> {
  z.uuid().parse(batchId);
  return inTransaction(db, async (tx) => {
    const batch = await lockBatch(tx, batchId);
    assertOpen(batch);
    await tx.delete(importRows).where(eq(importRows.batchId, batchId));
    // batch besar dipecah supaya jumlah parameter query tetap di bawah batas postgres
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(importRows).values(
        rows.slice(i, i + 500).map((r) => ({ batchId, rowHash: r.rowHash, raw: r.raw, parsed: r.parsed, matchedTransactionId: r.matchedTransactionId })),
      );
    }
    await tx.update(importBatches).set({ status: "review", error: null, updatedAt: new Date() }).where(eq(importBatches.id, batchId));
    return { count: rows.length };
  });
}

/** Batch gagal; batch yang sudah hilang (dibatalkan saat worker berjalan) diabaikan. */
export async function markImportBatchFailed(viewer: Viewer, batchId: string, message: string, db: DbOrTx = defaultDb): Promise<void> {
  const text = z.string().trim().min(1).max(500).parse(message);
  await inTransaction(db, async (tx) => {
    const [batch] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).for("update");
    if (!batch || batch.status === "committed") return;
    await tx.delete(importRows).where(eq(importRows.batchId, batchId));
    await tx.update(importBatches).set({ status: "failed", error: text, updatedAt: new Date() }).where(eq(importBatches.id, batchId));
  });
}

/** Batalkan impor yang belum disimpan; batch committed tidak bisa dihapus karena menjadi dasar Duplikat pasti. */
export async function discardImportBatch(viewer: Viewer, batchId: string, db: DbOrTx = defaultDb): Promise<void> {
  z.uuid().parse(batchId);
  await inTransaction(db, async (tx) => {
    await tx.delete(importBatches).where(and(eq(importBatches.id, batchId), ne(importBatches.status, "committed")));
  });
}
