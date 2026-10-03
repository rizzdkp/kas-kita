import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import { buildInsights, WEEK_DAYS, type Insight, type WeeklyFacts } from "@/components/dashboard/insight-templates";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, transactions } from "@/server/db/schema";
import { addDaysKey, startOfKey } from "@/server/metrics/_time";
import { categoryBreakdown } from "@/server/metrics/category-breakdown";
import { expenseByCategory, type InstantRange } from "./aggregates";
import type { BillWithStatus } from "./bills";
import type { BudgetWithStatus } from "./budgets";
import { accountInScope, countableTransaction, toAccounts, transactionInScope, transactionJoins } from "./scope";

export type { Insight };

/** Apakah cakupan punya transaksi sama sekali (state "[Nama] belum mencatat transaksi"). */
export async function scopeHasTransactions(viewer: Viewer, scope: Scope, db: DbOrTx = defaultDb): Promise<boolean> {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .where(and(transactionInScope(viewer, scope), sql`${transactions.deletedAt} is null`))
    .limit(1);
  return Boolean(row);
}

export interface OwnerFlow {
  ownerId: string | null;
  income: bigint;
  expense: bigint;
}

/** Pemasukan dan pengeluaran per pemilik akun, untuk segmen kontribusi di Gabungan. */
export async function flowsByOwner(viewer: Viewer, scope: Scope, range: InstantRange, db: DbOrTx = defaultDb): Promise<OwnerFlow[]> {
  const rows = await db
    .select({
      ownerId: accounts.ownerId,
      income: sql<bigint>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)::bigint`,
      expense: sql<bigint>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)::bigint`,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        countableTransaction(),
        accountInScope(viewer, scope),
        gte(transactions.occurredAt, range.start),
        lt(transactions.occurredAt, range.end),
        sql`not ${categories.isSystem}`,
      ),
    )
    .groupBy(accounts.ownerId);
  return rows.map((r) => ({ ownerId: r.ownerId, income: BigInt(r.income), expense: BigInt(r.expense) }));
}

/** Fakta minggu ini (7 hari terakhir WIB) untuk bagian Wawasan. */
export async function getWeeklyInsights(
  viewer: Viewer,
  scope: Scope,
  input: { today: string; budgets: BudgetWithStatus[]; bills: BillWithStatus[] },
  db: DbOrTx = defaultDb,
): Promise<Insight[]> {
  const weekFrom = addDaysKey(input.today, -(WEEK_DAYS - 1));
  const current = { start: startOfKey(weekFrom), end: startOfKey(addDaysKey(input.today, 1)) };
  const previous = { start: startOfKey(addDaysKey(weekFrom, -WEEK_DAYS)), end: current.start };
  const [rows, prevRows, countRow] = await Promise.all([
    expenseByCategory(viewer, scope, current, db),
    expenseByCategory(viewer, scope, previous, db),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .innerJoin(accounts, transactionJoins.fromAccount)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          countableTransaction(),
          eq(transactions.kind, "expense"),
          accountInScope(viewer, scope),
          gte(transactions.occurredAt, current.start),
          lt(transactions.occurredAt, current.end),
          sql`not ${categories.isSystem}`,
        ),
      ),
  ]);
  const now = categoryBreakdown(rows).value;
  const before = new Map(categoryBreakdown(prevRows).value.map((c) => [c.categoryId, c.total]));
  let topIncrease: WeeklyFacts["topIncrease"] = null;
  for (const c of now) {
    const prev = before.get(c.categoryId) ?? 0n;
    if (c.total > prev && (!topIncrease || c.total - prev > topIncrease.current - topIncrease.previous)) {
      topIncrease = { categoryId: c.categoryId, name: c.name, current: c.total, previous: prev };
    }
  }
  const fast = input.budgets.find((b) => b.status.value.state === "over" || b.status.value.fasterThanUsual);
  const bill = input.bills.find((b) => !b.overdue && b.daysUntilDue <= WEEK_DAYS);
  return buildInsights({
    scope,
    today: input.today,
    topIncrease,
    weekTotal: now.reduce((s, c) => s + c.total, 0n),
    weekCount: countRow[0]?.count ?? 0,
    fastBudget: fast
      ? {
          categoryId: fast.categoryId,
          name: fast.categoryName,
          usedPercent: fast.status.value.usedPercent ?? 0,
          elapsedPercent: fast.status.value.elapsedPercent,
          over: fast.status.value.state === "over",
        }
      : null,
    dueBill: bill ? { name: bill.name, amount: bill.amount, daysUntilDue: bill.daysUntilDue, categoryId: bill.categoryId } : null,
  });
}
