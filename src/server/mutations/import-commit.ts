import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { parseDateKey } from "@/lib/dates";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { importBatches, importRows, transactions } from "@/server/db/schema";
import { DomainError, ValidationError } from "@/server/errors";
import { storedParsedRowSchema, type StoredParsedRow } from "@/server/import/stored-row";
import { getCommittedRowHashes } from "@/server/queries/imports";
import { inTransaction, parseInput } from "./_shared";
import { insertWithAudit, updateWithAudit } from "./audit";
import { assertBalancesAllowed, balanceEffects } from "./balance-guard";
import { lockBatch, type ImportRowRecord } from "./imports";
import { assertReferences, createTransactionSchema } from "./transaction-input";

export const commitImportSchema = z.object({
  batchId: z.uuid(),
  rows: z
    .array(
      z.object({
        rowId: z.uuid(),
        action: z.enum(["import", "link", "skip"]),
        categoryId: z.uuid().nullish().transform((v) => v ?? null),
        beneficiary: z.enum(["owner", "partner_of_owner", "shared"]).default("owner"),
      }),
    )
    .max(5000),
});
export type CommitImportInput = z.input<typeof commitImportSchema>;

export interface CommitImportResult {
  batchId: string;
  created: number;
  linked: number;
  skipped: number;
}

export const PICK_CATEGORY_MESSAGE = "Pilih kategori";

/** Tanggal mutasi WIB; tanpa jam dipakai 12.00 seperti struk supaya tidak bergeser hari. */
export function importOccurredAt(parsed: Pick<StoredParsedRow, "date" | "time">): Date {
  const day = parseDateKey(parsed.date);
  if (!day) throw new ValidationError("Tanggal baris impor tidak valid");
  const [h, m] = (parsed.time ?? "12:00").split(":").map(Number) as [number, number];
  return new Date(day.getTime() + (h * 60 + m) * 60_000);
}

type Decision = z.output<typeof commitImportSchema>["rows"][number];

async function linkTransaction(tx: Tx, viewer: Viewer, accountId: string, row: ImportRowRecord, parsed: StoredParsedRow): Promise<void> {
  const transactionId = row.matchedTransactionId;
  const stale = new DomainError("import_link_stale", "Transaksi pembanding sudah berubah atau dihapus. Pilih Beda, impor sebagai baru, atau muat ulang halaman.");
  if (!transactionId) throw stale;
  const [t] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).for("update");
  if (!t || t.deletedAt || t.status !== "confirmed" || t.importRowId) throw stale;
  const inflow = t.kind === "income" || (t.kind === "transfer" && t.toAccountId === accountId);
  const touchesAccount = t.accountId === accountId || t.toAccountId === accountId;
  if (!touchesAccount || (inflow ? t.amount : -t.amount) !== BigInt(parsed.amount)) throw stale;
  const [taken] = await tx
    .select({ id: importRows.id })
    .from(importRows)
    .innerJoin(importBatches, eq(importBatches.id, importRows.batchId))
    .where(
      and(
        eq(importRows.matchedTransactionId, transactionId),
        eq(importRows.decision, "duplicate_of"),
        sql`${importRows.committedAt} is not null`,
        eq(importBatches.accountId, accountId),
      ),
    )
    .limit(1);
  if (taken) throw stale;
  // transfer punya dua ujung yang bisa diimpor dari dua akun, jadi tautannya cukup di import_rows
  if (t.kind !== "transfer") {
    await updateWithAudit(tx, transactions, { id: t.id, expectedVersion: t.version, actorId: viewer.user.id, values: { importRowId: row.id } });
  }
}

/** "Impor [n] transaksi": semua dalam satu transaksi database (UX-FLOWS 6 langkah 6). */
export async function commitImportBatch(viewer: Viewer, input: CommitImportInput, db: DbOrTx = defaultDb): Promise<CommitImportResult> {
  const data = parseInput(commitImportSchema, input);
  return inTransaction(db, async (tx) => {
    const batch = await lockBatch(tx, data.batchId);
    if (batch.status === "committed") throw new DomainError("import_committed", "Impor ini sudah disimpan. Lihat hasilnya di daftar transaksi.");
    if (batch.status !== "review") throw new DomainError("import_not_ready", "Impor ini belum siap ditinjau. Tunggu sebentar lalu muat ulang halaman.");

    const rows = await tx.select().from(importRows).where(eq(importRows.batchId, batch.id)).orderBy(importRows.createdAt, importRows.id);
    const decisions = new Map<string, Decision>(data.rows.map((d) => [d.rowId, d]));
    for (const id of decisions.keys()) {
      if (!rows.some((r) => r.id === id)) throw new ValidationError("Baris impor tidak ditemukan. Muat ulang halaman lalu coba lagi.");
    }
    // file lain yang di-commit sejak tinjauan dibuka bisa membuat baris ini jadi Duplikat pasti
    const nowCommitted = await getCommittedRowHashes(rows.map((r) => r.rowHash), tx);

    const toImport: Array<{ row: ImportRowRecord; parsed: StoredParsedRow; decision: Decision }> = [];
    const toLink: Array<{ row: ImportRowRecord; parsed: StoredParsedRow }> = [];
    const missingCategory: Record<string, string[]> = {};
    for (const row of rows) {
      const parsed = storedParsedRowSchema.parse(row.parsed);
      const decision = decisions.get(row.id);
      if (!decision || decision.action === "skip" || parsed.group === "exact_duplicate" || nowCommitted.has(row.rowHash)) continue;
      if (decision.action === "link") {
        if (parsed.group !== "possible_duplicate") throw new ValidationError("Baris ini tidak punya transaksi pembanding.");
        toLink.push({ row, parsed });
      } else if (!decision.categoryId) {
        missingCategory[`rows.${row.id}.categoryId`] = [PICK_CATEGORY_MESSAGE];
      } else {
        toImport.push({ row, parsed, decision });
      }
    }
    const missing = Object.keys(missingCategory).length;
    if (missing > 0) throw new ValidationError(`Pilih kategori untuk ${missing} transaksi yang dicentang.`, missingCategory);

    const source = batch.format === "csv" ? "import_csv" : "import_pdf";
    const inputs = toImport.map(({ row, parsed, decision }) =>
      parseInput(createTransactionSchema, {
        kind: BigInt(parsed.amount) > 0n ? "income" : "expense",
        amount: BigInt(parsed.amount) < 0n ? -BigInt(parsed.amount) : BigInt(parsed.amount),
        accountId: batch.accountId,
        categoryId: decision.categoryId,
        occurredAt: importOccurredAt(parsed),
        note: parsed.description.slice(0, 500),
        beneficiary: decision.beneficiary,
        source,
        importRowId: row.id,
      }),
    );
    await assertReferences(tx, inputs);
    await assertBalancesAllowed(tx, balanceEffects(inputs));
    for (const item of inputs) {
      await insertWithAudit(tx, transactions, { ...item, createdBy: viewer.user.id, updatedBy: viewer.user.id }, viewer.user.id);
    }
    for (const { row, parsed } of toLink) await linkTransaction(tx, viewer, batch.accountId, row, parsed);

    const now = new Date();
    const importIds = toImport.map((x) => x.row.id);
    const linkIds = toLink.map((x) => x.row.id);
    const decided = new Set([...importIds, ...linkIds]);
    const skipIds = rows.map((r) => r.id).filter((id) => !decided.has(id));
    if (importIds.length > 0) {
      await tx.update(importRows).set({ decision: "new", matchedTransactionId: null, committedAt: now, updatedAt: now }).where(inArray(importRows.id, importIds));
    }
    if (linkIds.length > 0) {
      await tx.update(importRows).set({ decision: "duplicate_of", committedAt: now, updatedAt: now }).where(inArray(importRows.id, linkIds));
    }
    if (skipIds.length > 0) {
      await tx.update(importRows).set({ decision: "skip", matchedTransactionId: null, committedAt: now, updatedAt: now }).where(inArray(importRows.id, skipIds));
    }
    await tx.update(importBatches).set({ status: "committed", error: null, updatedAt: now }).where(eq(importBatches.id, batch.id));
    return { batchId: batch.id, created: importIds.length, linked: linkIds.length, skipped: skipIds.length };
  });
}
