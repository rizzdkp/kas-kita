import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, importRows, transactions, users } from "@/server/db/schema";
import { suggestCategories, type CategoryHistoryEntry } from "@/server/import/category-suggest";
import { hasBalanceMismatch, storedParsedRowSchema } from "@/server/import/stored-row";
import type { DedupeGroup } from "@/server/import/types";
import { getImportBatch, type ImportBatchSummary } from "./imports";
import { toAccounts, transactionInScope, transactionJoins } from "./scope";

// riwayat terbaru cukup untuk saran; lebih banyak hanya memperlambat layar tinjau
const HISTORY_LIMIT = 3000;

export interface ReviewMatch {
  id: string;
  kind: "income" | "expense" | "transfer";
  amount: bigint;
  occurredAt: Date;
  note: string | null;
  categoryName: string | null;
  accountName: string;
  createdByName: string;
  source: string;
}

export interface ReviewRow {
  id: string;
  index: number;
  date: string;
  time: string | null;
  description: string;
  /** Bertanda: positif masuk, negatif keluar. */
  amount: bigint;
  balance: bigint | null;
  group: DedupeGroup;
  dayDiff: number | null;
  balanceMismatch: boolean;
  suggestedCategoryId: string | null;
  match: ReviewMatch | null;
}

export interface ImportReview {
  batch: ImportBatchSummary;
  rows: ReviewRow[];
  counts: Record<DedupeGroup, number>;
  balanceMismatchCount: number;
}

/** Riwayat deskripsi berkategori (catatan transaksi, termasuk hasil impor sebelumnya), terbaru dulu. */
export async function loadCategoryHistory(viewer: Viewer, db: DbOrTx = defaultDb): Promise<CategoryHistoryEntry[]> {
  const rows = await db
    .select({ kind: transactions.kind, categoryId: transactions.categoryId, note: transactions.note })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        transactionInScope(viewer, "all"),
        isNull(transactions.deletedAt),
        inArray(transactions.kind, ["income", "expense"]),
        isNotNull(transactions.note),
        ne(transactions.note, ""),
        isNull(categories.archivedAt),
        isNull(categories.deletedAt),
      ),
    )
    .orderBy(desc(transactions.occurredAt))
    .limit(HISTORY_LIMIT);
  return rows.flatMap((r) =>
    r.categoryId && r.note && r.kind !== "transfer" ? [{ kind: r.kind, categoryId: r.categoryId, text: r.note }] : [],
  );
}

async function loadMatches(viewer: Viewer, ids: string[], db: DbOrTx): Promise<Map<string, ReviewMatch>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      occurredAt: transactions.occurredAt,
      note: transactions.note,
      categoryName: categories.name,
      accountName: accounts.name,
      createdByName: users.displayName,
      source: transactions.source,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .innerJoin(users, eq(users.id, transactions.createdBy))
    .where(and(transactionInScope(viewer, "all"), inArray(transactions.id, ids), isNull(transactions.deletedAt)));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Data layar tinjau /impor/[batchId]; null bila batch tidak ada. */
export async function getImportReview(viewer: Viewer, batchId: string, db: DbOrTx = defaultDb): Promise<ImportReview | null> {
  const batch = await getImportBatch(viewer, batchId, db);
  if (!batch) return null;
  const counts: Record<DedupeGroup, number> = { new: 0, possible_duplicate: 0, exact_duplicate: 0 };
  if (batch.status !== "review") return { batch, rows: [], counts, balanceMismatchCount: 0 };

  const stored = await db.select().from(importRows).where(eq(importRows.batchId, batchId));
  const parsed = stored
    .map((r) => ({ record: r, data: storedParsedRowSchema.parse(r.parsed) }))
    .sort((a, b) => a.data.index - b.data.index);
  const matchIds = [...new Set(parsed.flatMap((p) => (p.record.matchedTransactionId ? [p.record.matchedTransactionId] : [])))];
  const [matches, history] = await Promise.all([loadMatches(viewer, matchIds, db), loadCategoryHistory(viewer, db)]);
  const suggestions = suggestCategories(
    parsed.map((p) => ({ kind: BigInt(p.data.amount) > 0n ? "income" : "expense", description: p.data.description })),
    history,
  );

  const rows: ReviewRow[] = parsed.map(({ record, data }, i) => {
    const match = record.matchedTransactionId ? (matches.get(record.matchedTransactionId) ?? null) : null;
    // pembanding yang sudah dihapus sejak dedupe membuat baris kembali jadi Baru
    const group: DedupeGroup = data.group === "possible_duplicate" && !match ? "new" : data.group;
    counts[group] += 1;
    return {
      id: record.id,
      index: data.index,
      date: data.date,
      time: data.time,
      description: data.description,
      amount: BigInt(data.amount),
      balance: data.balance === null ? null : BigInt(data.balance),
      group,
      dayDiff: group === "possible_duplicate" ? data.dayDiff : null,
      balanceMismatch: hasBalanceMismatch(record.raw),
      suggestedCategoryId: suggestions[i] ?? null,
      match: group === "possible_duplicate" ? match : null,
    };
  });
  return { batch, rows, counts, balanceMismatchCount: rows.filter((r) => r.balanceMismatch).length };
}
