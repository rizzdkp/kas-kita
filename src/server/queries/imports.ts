import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, importBatches, importRows, institutions, transactions } from "@/server/db/schema";
import type { DedupeCandidate } from "@/server/import/dedupe";
import { addDaysKey, keyOf, startOfKey } from "@/server/metrics/_time";
import { toAccounts, transactionInScope, transactionJoins } from "./scope";

/** Hash yang sudah masuk lewat batch committed dengan keputusan selain skip (dasar Duplikat pasti). */
export async function getCommittedRowHashes(hashes: string[], db: DbOrTx = defaultDb): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const found = new Set<string>();
  for (let i = 0; i < hashes.length; i += 1000) {
    const rows = await db
      .select({ rowHash: importRows.rowHash })
      .from(importRows)
      .where(and(inArray(importRows.rowHash, hashes.slice(i, i + 1000)), ne(importRows.decision, "skip"), isNotNull(importRows.committedAt)));
    for (const r of rows) found.add(r.rowHash);
  }
  return found;
}

/**
 * Transaksi terkonfirmasi di akun impor yang belum tertaut ke baris impor mana pun, dalam rentang tanggal file
 * diperlebar jendela dedupe. Nominal bertanda dari sudut akun impor; transfer ikut karena bank juga mencatatnya.
 */
export async function getDedupeCandidates(
  viewer: Viewer,
  input: { accountId: string; from: string; to: string; windowDays: number },
  db: DbOrTx = defaultDb,
): Promise<DedupeCandidate[]> {
  const { accountId, windowDays } = input;
  const rows = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      accountId: transactions.accountId,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .where(
      and(
        transactionInScope(viewer, "all"),
        eq(transactions.status, "confirmed"),
        isNull(transactions.deletedAt),
        isNull(transactions.importRowId),
        or(eq(transactions.accountId, accountId), and(eq(transactions.kind, "transfer"), eq(transactions.toAccountId, accountId))),
        gte(transactions.occurredAt, startOfKey(addDaysKey(input.from, -windowDays))),
        lt(transactions.occurredAt, startOfKey(addDaysKey(input.to, windowDays + 1))),
        sql`not exists (
          select 1 from ${importRows} r join ${importBatches} b on b.id = r.batch_id
          where r.matched_transaction_id = ${transactions.id} and r.decision = 'duplicate_of'
            and r.committed_at is not null and b.account_id = ${accountId}::uuid
        )`,
      ),
    )
    .orderBy(transactions.occurredAt, transactions.id);
  return rows.map((r) => {
    const outflow = r.kind === "expense" || (r.kind === "transfer" && r.accountId === accountId);
    return { id: r.id, date: keyOf(r.occurredAt), amount: outflow ? -r.amount : r.amount };
  });
}

export interface ImportBatchSummary {
  id: string;
  accountId: string;
  accountName: string;
  accountOwnerId: string | null;
  institutionName: string | null;
  format: "csv" | "pdf" | "ai_pdf";
  status: "parsing" | "review" | "committed" | "failed";
  error: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Batch impor untuk layar tinjau dan polling status; data rumah tangga, tidak dibatasi cakupan. */
export async function getImportBatch(viewer: Viewer, batchId: string, db: DbOrTx = defaultDb): Promise<ImportBatchSummary | null> {
  const [row] = await db
    .select({
      id: importBatches.id,
      accountId: importBatches.accountId,
      accountName: accounts.name,
      accountOwnerId: accounts.ownerId,
      institutionName: institutions.name,
      format: importBatches.format,
      status: importBatches.status,
      error: importBatches.error,
      createdBy: importBatches.createdBy,
      createdAt: importBatches.createdAt,
      updatedAt: importBatches.updatedAt,
    })
    .from(importBatches)
    .innerJoin(accounts, eq(accounts.id, importBatches.accountId))
    .leftJoin(institutions, eq(institutions.id, importBatches.institutionId))
    .where(eq(importBatches.id, batchId));
  return row ?? null;
}
