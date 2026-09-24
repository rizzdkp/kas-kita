import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, billPayments, budgets, categories, transactions } from "@/server/db/schema";
import { addDaysKey, diffDaysKey, keyOf, monthEndKey, monthStartKey, startOfKey } from "@/server/metrics/_time";
import { FORECAST_WINDOW_DAYS, monthEndForecast, type Forecast } from "@/server/metrics/forecast";
import type { Metric } from "@/server/metrics/types";
import { sumFlows } from "./aggregates";
import { listBills } from "./bills";
import { billsDueBefore } from "./dashboard-inputs";
import { accountInScope, budgetInScope, budgetOwnerIdFromKey, countableTransaction, transactionJoins } from "./scope";

function mandatoryKey(ownerId: string | null, categoryId: string): string {
  return `${ownerId ?? "shared"}:${categoryId}`;
}

/** Hari sejak transaksi pertama di cakupan sampai kemarin (0 kalau belum ada). */
async function countDataDays(viewer: Viewer, scope: Scope, today: string, db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ first: sql<string | null>`to_char(min(${transactions.occurredAt}) at time zone 'Asia/Jakarta', 'YYYY-MM-DD')` })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .where(and(countableTransaction(), accountInScope(viewer, scope)));
  return row?.first ? Math.max(0, diffDaysKey(row.first, today)) : 0;
}

/** Pengeluaran fleksibel per hari: tanpa kategori beranggaran wajib bulan ini dan tanpa pembayaran tagihan. */
async function dailyFlexibleExpense(
  viewer: Viewer,
  scope: Scope,
  opts: { windowStart: string; today: string; month: string },
  db: DbOrTx,
): Promise<bigint[]> {
  const mandatory = await db
    .select({ scopeOwner: budgets.scopeOwner, categoryId: budgets.categoryId })
    .from(budgets)
    .where(
      and(
        eq(budgets.month, opts.month),
        eq(budgets.isMandatory, true),
        isNull(budgets.deletedAt),
        budgetInScope(budgets.scopeOwner, viewer, scope),
      ),
    );
  const mandatorySet = new Set(mandatory.map((b) => mandatoryKey(budgetOwnerIdFromKey(b.scopeOwner), b.categoryId)));

  const day = sql<string>`to_char(${transactions.occurredAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day,
      ownerId: accounts.ownerId,
      categoryId: categories.id,
      parentId: categories.parentId,
      amount: sql<bigint>`sum(${transactions.amount})::bigint`,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(billPayments, eq(billPayments.transactionId, transactions.id))
    .where(
      and(
        countableTransaction(),
        eq(transactions.kind, "expense"),
        accountInScope(viewer, scope),
        gte(transactions.occurredAt, startOfKey(opts.windowStart)),
        lt(transactions.occurredAt, startOfKey(opts.today)),
        sql`not ${categories.isSystem}`,
        isNull(billPayments.id),
      ),
    )
    .groupBy(day, accounts.ownerId, categories.id);

  const length = diffDaysKey(opts.windowStart, opts.today);
  const daily = Array.from({ length }, () => 0n);
  for (const r of rows) {
    const isMandatory =
      mandatorySet.has(mandatoryKey(r.ownerId, r.categoryId)) ||
      (r.parentId !== null && mandatorySet.has(mandatoryKey(r.ownerId, r.parentId)));
    const index = diffDaysKey(opts.windowStart, r.day);
    if (isMandatory || index < 0 || index >= length) continue;
    daily[index] = daily[index]! + BigInt(r.amount);
  }
  return daily;
}

/** Prediksi pengeluaran akhir bulan berjalan untuk cakupan (F-BUD-2). */
export async function getMonthEndForecast(
  viewer: Viewer,
  scope: Scope,
  now: Date = new Date(),
  db: DbOrTx = defaultDb,
): Promise<Metric<Forecast>> {
  const today = keyOf(now);
  const month = monthStartKey(today);
  const periodLast = monthEndKey(today);
  const dataDays = await countDataDays(viewer, scope, today, db);
  const windowDays = Math.min(FORECAST_WINDOW_DAYS, dataDays);
  const windowStart = addDaysKey(today, -windowDays);

  const [dailyFlexible, flows, bills] = await Promise.all([
    dailyFlexibleExpense(viewer, scope, { windowStart, today, month }, db),
    sumFlows(viewer, scope, { start: startOfKey(month), end: startOfKey(addDaysKey(today, 1)) }, db),
    listBills(viewer, scope, { today }, db),
  ]);
  // tagihan kartu kredit dibayar lewat transfer, jadi bukan pengeluaran
  const expenseBills = bills.filter((b) => !b.creditCardAccountId);

  return monthEndForecast({
    today,
    periodLast,
    spentSoFar: flows.expense,
    dataDays,
    dailyFlexible,
    billsRemaining: billsDueBefore(expenseBills, addDaysKey(periodLast, 1)),
  });
}
