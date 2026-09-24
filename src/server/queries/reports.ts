import { and, eq, gte, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, transactions } from "@/server/db/schema";
import { startOfKey } from "@/server/metrics/_time";
import { formatMonthLong, reportRanges, shiftMonth, type ReportRanges } from "@/components/reports/months";
import { categoryBreakdown, type CategorySpendRow, type CategoryTotal } from "@/server/metrics/category-breakdown";
import { periodExpense } from "@/server/metrics/period-expense";
import { periodIncome } from "@/server/metrics/period-income";
import { savingsRate } from "@/server/metrics/savings-rate";
import type { Metric } from "@/server/metrics/types";
import { expenseByCategory, sumFlows, type InstantRange } from "./aggregates";
import { accountInScope, countableTransaction, transactionJoins } from "./scope";

const reportParents = alias(categories, "report_parent_categories");
export const TREND_MONTHS = 12;

export { formatMonthAxis, formatMonthLong, parseMonthParam, reportRanges, shiftMonth } from "@/components/reports/months";
export type { ReportRange, ReportRanges } from "@/components/reports/months";

/** Pemasukan per kategori dan per pemilik akun; bentuknya sama dengan expenseByCategory. */
export async function incomeByCategory(viewer: Viewer, scope: Scope, range: InstantRange, db: DbOrTx = defaultDb): Promise<CategorySpendRow[]> {
  const rows = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      icon: categories.icon,
      parentId: categories.parentId,
      parentName: reportParents.name,
      parentIcon: reportParents.icon,
      ownerId: accounts.ownerId,
      amount: sql<bigint>`sum(${transactions.amount})::bigint`,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(reportParents, eq(reportParents.id, categories.parentId))
    .where(
      and(
        countableTransaction(),
        eq(transactions.kind, "income"),
        accountInScope(viewer, scope),
        gte(transactions.occurredAt, range.start),
        lt(transactions.occurredAt, range.end),
        sql`not ${categories.isSystem}`,
      ),
    )
    .groupBy(categories.id, reportParents.id, accounts.ownerId);
  return rows.map((r) => ({ ...r, amount: BigInt(r.amount) }));
}

export interface MonthFlow {
  month: string;
  income: bigint;
  expense: bigint;
}

/** Pemasukan dan pengeluaran per bulan kalender WIB; bulan tanpa transaksi diisi nol. */
export async function monthlyFlows(viewer: Viewer, scope: Scope, lastMonth: string, months: number, db: DbOrTx = defaultDb): Promise<MonthFlow[]> {
  const firstMonth = shiftMonth(lastMonth, -(months - 1));
  const monthExpr = sql<string>`to_char(${transactions.occurredAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`;
  const rows = await db
    .select({
      month: monthExpr,
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
        gte(transactions.occurredAt, startOfKey(`${firstMonth}-01`)),
        lt(transactions.occurredAt, startOfKey(`${shiftMonth(lastMonth, 1)}-01`)),
        sql`not ${categories.isSystem}`,
      ),
    )
    .groupBy(monthExpr);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(firstMonth, i);
    const r = byMonth.get(month);
    return { month, income: BigInt(r?.income ?? 0n), expense: BigInt(r?.expense ?? 0n) };
  });
}

export interface CategoryWithPrevious extends CategoryTotal {
  previous: bigint;
}

export interface MonthlyReport {
  scope: Scope;
  ranges: ReportRanges;
  label: string;
  income: Metric<bigint>;
  expense: Metric<bigint>;
  net: Metric<bigint>;
  savingsRate: Metric<number | null>;
  previousIncome: bigint;
  previousExpense: bigint;
  expenseCategories: Metric<CategoryWithPrevious[]>;
  incomeCategories: Metric<CategoryWithPrevious[]>;
  trend: Metric<MonthFlow[]>;
}

function withPrevious(current: Metric<CategoryTotal[]>, previous: CategoryTotal[], formula: string): Metric<CategoryWithPrevious[]> {
  const prev = new Map(previous.map((c) => [c.categoryId, c.total]));
  return { ...current, formula, value: current.value.map((c) => ({ ...c, previous: prev.get(c.categoryId) ?? 0n })) };
}

/** Laporan satu bulan kalender untuk cakupan (F-REP-1). */
export async function getMonthlyReport(viewer: Viewer, scope: Scope, month: string, today: string, db: DbOrTx = defaultDb): Promise<MonthlyReport> {
  const ranges = reportRanges(month, today);
  const [flows, prevFlows, expenseRows, prevExpenseRows, incomeRows, prevIncomeRows, trend] = await Promise.all([
    sumFlows(viewer, scope, ranges.current, db),
    sumFlows(viewer, scope, ranges.previous, db),
    expenseByCategory(viewer, scope, ranges.current, db),
    expenseByCategory(viewer, scope, ranges.previous, db),
    incomeByCategory(viewer, scope, ranges.current, db),
    incomeByCategory(viewer, scope, ranges.previous, db),
    monthlyFlows(viewer, scope, month, TREND_MONTHS, db),
  ]);
  const label = ranges.current.label;
  const net = flows.income - flows.expense;
  return {
    scope,
    ranges,
    label: formatMonthLong(month),
    income: periodIncome({ total: flows.income, count: flows.incomeCount, periodLabel: label }),
    expense: periodExpense({ total: flows.expense, count: flows.expenseCount, periodLabel: label }),
    net: {
      value: net,
      formula: "Selisih = pemasukan − pengeluaran periode ini. Transfer tidak dihitung.",
      inputs: { Pemasukan: flows.income, Pengeluaran: flows.expense },
    },
    savingsRate: savingsRate(flows.income, flows.expense),
    previousIncome: prevFlows.income,
    previousExpense: prevFlows.expense,
    expenseCategories: withPrevious(
      categoryBreakdown(expenseRows),
      categoryBreakdown(prevExpenseRows).value,
      `Pengeluaran per kategori = jumlah transaksi Pengeluaran ${label} per kategori induk. Pembanding: ${ranges.previous.label}`,
    ),
    incomeCategories: withPrevious(
      categoryBreakdown(incomeRows),
      categoryBreakdown(prevIncomeRows).value,
      `Pemasukan per kategori = jumlah transaksi Pemasukan ${label} per kategori induk. Pembanding: ${ranges.previous.label}`,
    ),
    trend: {
      value: trend,
      formula: "Tiap bulan: jumlah Pemasukan dan jumlah Pengeluaran bulan kalender itu (WIB), tanpa transfer dan Penyesuaian saldo",
      inputs: Object.fromEntries(trend.flatMap((t) => [[`Pemasukan ${formatMonthLong(t.month)}`, t.income], [`Pengeluaran ${formatMonthLong(t.month)}`, t.expense]])),
    },
  };
}
