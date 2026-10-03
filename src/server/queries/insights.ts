import { and, asc, desc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, billPayments, categories, insights, transactions } from "@/server/db/schema";
import type { InstantRange } from "./aggregates";
import { accountInScope, countableTransaction, transactionJoins } from "./scope";

export interface SourceFilter {
  range: InstantRange;
  /** Kategori induk atau anaknya. */
  categoryId?: string;
  /** Pemilik akun tertentu (anggaran); null = Bersama. */
  ownerId?: string | null;
}

/** Id transaksi pengeluaran penyusun fakta wawasan, dengan aturan hitung yang sama dengan metrik. */
export async function insightSourceTransactionIds(viewer: Viewer, scope: Scope, f: SourceFilter, db: DbOrTx = defaultDb): Promise<string[]> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        countableTransaction(),
        eq(transactions.kind, "expense"),
        accountInScope(viewer, scope),
        gte(transactions.occurredAt, f.range.start),
        lt(transactions.occurredAt, f.range.end),
        sql`not ${categories.isSystem}`,
        f.categoryId ? or(eq(categories.id, f.categoryId), eq(categories.parentId, f.categoryId)) : undefined,
        f.ownerId === undefined ? undefined : f.ownerId === null ? isNull(accounts.ownerId) : eq(accounts.ownerId, f.ownerId),
      ),
    )
    .orderBy(asc(transactions.occurredAt), asc(transactions.id));
  return rows.map((r) => r.id);
}

const BILL_SOURCE_PAYMENTS = 3;

/** Transaksi pembayaran terakhir sebuah tagihan, sebagai penyusun wawasan tagihan. */
export async function billPaymentTransactionIds(billId: string, db: DbOrTx = defaultDb): Promise<string[]> {
  const rows = await db
    .select({ id: billPayments.transactionId })
    .from(billPayments)
    .where(and(eq(billPayments.billId, billId), isNotNull(billPayments.transactionId)))
    .orderBy(desc(billPayments.paidAt))
    .limit(BILL_SOURCE_PAYMENTS);
  return rows.map((r) => r.id).filter((id): id is string => id !== null);
}

export type InsightRow = typeof insights.$inferSelect;

/** Baris wawasan tersimpan satu cakupan untuk satu minggu, urut sesuai penyimpanan. */
export async function listStoredInsights(scopeKey: string, weekStart: string, db: DbOrTx = defaultDb): Promise<InsightRow[]> {
  return db
    .select()
    .from(insights)
    .where(and(eq(insights.scope, scopeKey), eq(insights.weekStart, weekStart)))
    .orderBy(asc(insights.createdAt), asc(insights.id));
}
