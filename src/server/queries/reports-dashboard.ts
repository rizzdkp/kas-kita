import { and, eq, gte, lt, sql } from "drizzle-orm";
import { formatCountdown } from "@/lib/dates";
import { formatPercent, formatRupiah } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { transactionHref } from "@/components/reports/transaction-link";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, transactions } from "@/server/db/schema";
import { addDaysKey, monthStartKey, startOfKey } from "@/server/metrics/_time";
import { categoryBreakdown } from "@/server/metrics/category-breakdown";
import { expenseByCategory, type InstantRange } from "./aggregates";
import type { BillWithStatus } from "./bills";
import type { BudgetWithStatus } from "./budgets";
import { accountInScope, countableTransaction, toAccounts, transactionInScope, transactionJoins } from "./scope";

const WEEK_DAYS = 7;
export const MAX_INSIGHTS = 3;

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

export interface Insight {
  key: string;
  text: string;
  href: string;
}

export interface WeeklyFacts {
  scope: Scope;
  today: string;
  /** Kategori dengan kenaikan terbesar 7 hari terakhir dibanding 7 hari sebelumnya. */
  topIncrease: { categoryId: string; name: string; current: bigint; previous: bigint } | null;
  weekTotal: bigint;
  weekCount: number;
  /** Anggaran yang lajunya lebih cepat dari hari berlalu atau sudah lewat. */
  fastBudget: { categoryId: string; name: string; usedPercent: number; elapsedPercent: number; over: boolean } | null;
  dueBill: { name: string; amount: bigint; daysUntilDue: number; categoryId: string | null } | null;
}

/** F-AI-2 AC4: templat kalimat tetap; semua angka disisipkan kode dari fakta. */
export function buildInsights(f: WeeklyFacts): Insight[] {
  const weekFrom = addDaysKey(f.today, -(WEEK_DAYS - 1));
  const out: Insight[] = [];
  if (f.topIncrease) {
    const t = f.topIncrease;
    out.push({
      key: "category",
      text:
        t.previous > 0n
          ? `Pengeluaran ${t.name} 7 hari terakhir ${formatRupiah(t.current)}, naik ${formatRupiah(t.current - t.previous)} dari 7 hari sebelumnya.`
          : `Pengeluaran ${t.name} 7 hari terakhir ${formatRupiah(t.current)}, sebelumnya tidak ada.`,
      href: transactionHref({ scope: f.scope, categoryIds: [t.categoryId], from: weekFrom, to: f.today }),
    });
  }
  if (f.fastBudget) {
    const b = f.fastBudget;
    out.push({
      key: "budget",
      text: b.over
        ? `Anggaran ${b.name} sudah lewat, terpakai ${formatPercent(b.usedPercent)}.`
        : `Anggaran ${b.name} sudah terpakai ${formatPercent(b.usedPercent)}, padahal bulan baru berjalan ${formatPercent(b.elapsedPercent)}.`,
      href: transactionHref({ scope: f.scope, categoryIds: [b.categoryId], from: monthStartKey(f.today), to: f.today }),
    });
  }
  if (f.weekCount > 0) {
    out.push({
      key: "week",
      text: `Total pengeluaran 7 hari terakhir ${formatRupiah(f.weekTotal)} dari ${f.weekCount} transaksi.`,
      href: transactionHref({ scope: f.scope, kinds: ["expense"], from: weekFrom, to: f.today }),
    });
  }
  if (out.length < MAX_INSIGHTS && f.dueBill) {
    const b = f.dueBill;
    out.push({
      key: "bill",
      text: `Tagihan ${b.name} ${formatRupiah(b.amount)} jatuh tempo ${formatCountdown(b.daysUntilDue)}.`,
      href: b.categoryId
        ? transactionHref({ scope: f.scope, categoryIds: [b.categoryId] })
        : transactionHref({ scope: f.scope, q: b.name }),
    });
  }
  return out.slice(0, MAX_INSIGHTS);
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
