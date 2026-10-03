import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { billPayments, categories, insights } from "@/server/db/schema";
import type { InstantRange } from "./aggregates";
import { categoryLines, lineInRange, lineInScope, lineOwnedBy } from "./scope";

export interface SourceFilter {
  range: InstantRange;
  /** Kategori induk atau anaknya. */
  categoryId?: string;
  /** Pemilik akun tertentu (anggaran); null = Bersama. */
  ownerId?: string | null;
}

/** Id transaksi pengeluaran penyusun fakta wawasan, dari baris kategori yang sama dengan metrik (termasuk split). */
export async function insightSourceTransactionIds(viewer: Viewer, scope: Scope, f: SourceFilter, db: DbOrTx = defaultDb): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: categoryLines.transactionId, occurredAt: categoryLines.occurredAt })
    .from(categoryLines)
    .innerJoin(categories, eq(categories.id, categoryLines.categoryId))
    .where(
      and(
        sql`${categoryLines.kind} = 'expense'`,
        lineInScope(viewer, scope),
        lineInRange(f.range),
        f.categoryId ? or(eq(categories.id, f.categoryId), eq(categories.parentId, f.categoryId)) : undefined,
        f.ownerId === undefined ? undefined : lineOwnedBy(f.ownerId),
      ),
    )
    .orderBy(asc(categoryLines.occurredAt), asc(categoryLines.transactionId));
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
