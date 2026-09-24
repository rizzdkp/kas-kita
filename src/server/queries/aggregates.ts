import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, transactions } from "@/server/db/schema";
import type { CategorySpendRow } from "@/server/metrics/category-breakdown";
import { accountInScope, countableTransaction, toAccounts, transactionJoins } from "./scope";

const parentCategories = alias(categories, "agg_parent_categories");

export interface InstantRange {
  start: Date;
  end: Date;
}

function inRange(r: InstantRange) {
  return and(gte(transactions.occurredAt, r.start), lt(transactions.occurredAt, r.end));
}

// kategori sistem (Penyesuaian saldo) tidak masuk pemasukan, pengeluaran, dan rasio tabungan (F-ACC-2 AC1)
const notSystemCategory = sql`not ${categories.isSystem}`;

export interface FlowTotals {
  income: bigint;
  incomeCount: number;
  expense: bigint;
  expenseCount: number;
}

/** Pemasukan dan pengeluaran periode untuk akun di cakupan; transfer tidak pernah dihitung. */
export async function sumFlows(viewer: Viewer, scope: Scope, range: InstantRange, db: DbOrTx = defaultDb): Promise<FlowTotals> {
  const [row] = await db
    .select({
      income: sql<bigint>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)::bigint`,
      incomeCount: sql<number>`(count(*) filter (where ${transactions.kind} = 'income'))::int`,
      expense: sql<bigint>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)::bigint`,
      expenseCount: sql<number>`(count(*) filter (where ${transactions.kind} = 'expense'))::int`,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(countableTransaction(), accountInScope(viewer, scope), inRange(range), notSystemCategory));
  return {
    income: BigInt(row?.income ?? 0n),
    incomeCount: row?.incomeCount ?? 0,
    expense: BigInt(row?.expense ?? 0n),
    expenseCount: row?.expenseCount ?? 0,
  };
}

/** Pengeluaran per kategori dan per pemilik akun (untuk segmen Gabungan). */
export async function expenseByCategory(
  viewer: Viewer,
  scope: Scope,
  range: InstantRange,
  db: DbOrTx = defaultDb,
): Promise<CategorySpendRow[]> {
  const rows = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      icon: categories.icon,
      parentId: categories.parentId,
      parentName: parentCategories.name,
      parentIcon: parentCategories.icon,
      ownerId: accounts.ownerId,
      amount: sql<bigint>`sum(${transactions.amount})::bigint`,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parentCategories, eq(parentCategories.id, categories.parentId))
    .where(
      and(
        countableTransaction(),
        eq(transactions.kind, "expense"),
        accountInScope(viewer, scope),
        inRange(range),
        notSystemCategory,
      ),
    )
    .groupBy(categories.id, parentCategories.id, accounts.ownerId);
  return rows.map((r) => ({ ...r, amount: BigInt(r.amount) }));
}

/** Pengeluaran per pemilik akun dan kategori (dasar status anggaran). */
export async function expenseByOwnerAndCategory(
  range: InstantRange,
  db: DbOrTx = defaultDb,
): Promise<Array<{ ownerId: string | null; categoryId: string; parentId: string | null; amount: bigint }>> {
  const rows = await db
    .select({
      ownerId: accounts.ownerId,
      categoryId: categories.id,
      parentId: categories.parentId,
      amount: sql<bigint>`sum(${transactions.amount})::bigint`,
    })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(countableTransaction(), eq(transactions.kind, "expense"), inRange(range)))
    .groupBy(accounts.ownerId, categories.id);
  return rows.map((r) => ({ ...r, amount: BigInt(r.amount) }));
}

/** Pembayaran ke akun pinjaman dan PayLater dari akun di cakupan (rasio cicilan). */
export async function sumDebtPayments(viewer: Viewer, scope: Scope, range: InstantRange, db: DbOrTx = defaultDb): Promise<bigint> {
  const [row] = await db
    .select({ total: sql<bigint>`coalesce(sum(${transactions.amount}), 0)::bigint` })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .innerJoin(toAccounts, transactionJoins.toAccount)
    .where(
      and(
        countableTransaction(),
        eq(transactions.kind, "transfer"),
        inArray(toAccounts.type, ["loan", "paylater"]),
        accountInScope(viewer, scope),
        inRange(range),
      ),
    );
  return BigInt(row?.total ?? 0n);
}

/** Setoran ke akun tertentu (transfer masuk) di rentang, per akun. */
export async function sumTransfersInto(
  accountIds: string[],
  range: InstantRange,
  db: DbOrTx = defaultDb,
): Promise<Map<string, bigint>> {
  const result = new Map<string, bigint>();
  if (accountIds.length === 0) return result;
  const rows = await db
    .select({ accountId: transactions.toAccountId, total: sql<bigint>`sum(${transactions.amount})::bigint` })
    .from(transactions)
    .where(
      and(
        countableTransaction(),
        eq(transactions.kind, "transfer"),
        inArray(transactions.toAccountId, accountIds),
        inRange(range),
      ),
    )
    .groupBy(transactions.toAccountId);
  for (const r of rows) if (r.accountId) result.set(r.accountId, BigInt(r.total));
  return result;
}
