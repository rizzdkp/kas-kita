import { and, eq, inArray, isNull, ne, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { accounts, categories, transactionSplits, transactions } from "@/server/db/schema";

// satu-satunya tempat filter pemilik (AGENTS.md aturan 2); Bersama (owner_id NULL) hanya di "all"

export interface ScopeOwners {
  all: boolean;
  /** Pemilik yang masuk cakupan; kosong berarti tidak ada akun (misalnya partner belum ada). */
  ownerIds: string[];
}

export function scopeOwnerIds(viewer: Viewer, scope: Scope): ScopeOwners {
  if (scope === "all") {
    return { all: true, ownerIds: [viewer.user.id, ...(viewer.partner ? [viewer.partner.id] : [])] };
  }
  if (scope === "partner") return { all: false, ownerIds: viewer.partner ? [viewer.partner.id] : [] };
  return { all: false, ownerIds: [viewer.user.id] };
}

/** Kondisi pemilik untuk kolom owner_id mana pun (akun, tagihan, target). */
export function ownerInScope(ownerColumn: AnyColumn | SQL, viewer: Viewer, scope: Scope): SQL {
  const owners = scopeOwnerIds(viewer, scope);
  if (owners.all) return sql`true`;
  if (owners.ownerIds.length === 0) return sql`false`;
  return sql`${ownerColumn} in (${sql.join(
    owners.ownerIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** Pemilik JS: sama dengan ownerInScope tapi untuk data yang sudah dimuat. */
export function ownerIdInScope(ownerId: string | null, viewer: Viewer, scope: Scope): boolean {
  const owners = scopeOwnerIds(viewer, scope);
  if (owners.all) return true;
  return ownerId !== null && owners.ownerIds.includes(ownerId);
}

export type AccountsTable = { ownerId: AnyColumn };

export function accountInScope(viewer: Viewer, scope: Scope, table: AccountsTable = accounts): SQL {
  return ownerInScope(table.ownerId, viewer, scope);
}

/** Halaman Akun: akun Bersama selalu tampil di semua cakupan. */
export function accountVisibleOnAccountsPage(viewer: Viewer, scope: Scope, table: AccountsTable = accounts): SQL {
  const owners = scopeOwnerIds(viewer, scope);
  if (owners.all) return sql`true`;
  return or(isNull(table.ownerId), ownerInScope(table.ownerId, viewer, scope)) ?? sql`false`;
}

// akun tujuan transfer; setiap query transaksi ber-cakupan wajib left join alias ini
export const toAccounts = alias(accounts, "to_accounts");

export const transactionJoins = {
  fromAccount: eq(accounts.id, transactions.accountId),
  toAccount: eq(toAccounts.id, transactions.toAccountId),
};

/** Transaksi yang menyentuh cakupan: akun asal di cakupan, atau transfer yang masuk ke akun di cakupan. */
export function transactionInScope(viewer: Viewer, scope: Scope): SQL {
  const owners = scopeOwnerIds(viewer, scope);
  if (owners.all) return sql`true`;
  return (
    or(
      accountInScope(viewer, scope, accounts),
      and(eq(transactions.kind, "transfer"), accountInScope(viewer, scope, toAccounts)),
    ) ?? sql`false`
  );
}

/** Transaksi yang dihitung di saldo dan metrik: terkonfirmasi dan tidak dihapus. */
export function countableTransaction(): SQL {
  return and(eq(transactions.status, "confirmed"), isNull(transactions.deletedAt)) ?? sql`true`;
}

export const CASH_FLOWS = ["income", "expense", "transfer_in", "transfer_out", "transfer_internal"] as const;
export type CashFlow = (typeof CASH_FLOWS)[number];

/** Transfer yang kedua ujungnya di cakupan jadi transfer_internal dan tidak tampil di arus kas. */
export function transactionFlow(viewer: Viewer, scope: Scope): SQL<CashFlow> {
  const fromIn = accountInScope(viewer, scope, accounts);
  const toIn = accountInScope(viewer, scope, toAccounts);
  return sql<CashFlow>`case
    when ${transactions.kind} = 'income' then 'income'
    when ${transactions.kind} = 'expense' then 'expense'
    when (${fromIn}) and (${toIn}) then 'transfer_internal'
    when (${fromIn}) then 'transfer_out'
    else 'transfer_in'
  end`;
}

export function flowFromOwners(
  kind: "income" | "expense" | "transfer",
  fromOwnerId: string | null,
  toOwnerId: string | null,
  viewer: Viewer,
  scope: Scope,
): CashFlow {
  if (kind !== "transfer") return kind;
  const fromIn = ownerIdInScope(fromOwnerId, viewer, scope);
  const toIn = ownerIdInScope(toOwnerId, viewer, scope);
  if (fromIn && toIn) return "transfer_internal";
  return fromIn ? "transfer_out" : "transfer_in";
}

/** Kunci pemilik anggaran: "user:<uuid>" atau "shared". */
export function budgetOwnerKey(ownerId: string | null): string {
  return ownerId ? `user:${ownerId}` : "shared";
}

export function budgetOwnerIdFromKey(key: string): string | null {
  return key.startsWith("user:") ? key.slice(5) : null;
}

/** Anggaran per cakupan: Saya dan Partner hanya anggaran pribadinya, Gabungan semua termasuk Bersama. */
export function budgetInScope(scopeOwnerColumn: AnyColumn, viewer: Viewer, scope: Scope): SQL {
  const owners = scopeOwnerIds(viewer, scope);
  if (owners.all) return sql`true`;
  if (owners.ownerIds.length === 0) return sql`false`;
  return inArray(scopeOwnerColumn, owners.ownerIds.map((id) => budgetOwnerKey(id)));
}

const lineMainCategories = alias(categories, "line_main_categories");

/**
 * Baris kategori: sumber tunggal semua agregasi per kategori (keputusan 0015). Transaksi yang dihitung
 * (terkonfirmasi, tidak dihapus, bukan transfer, kategori utamanya bukan kategori sistem) menghasilkan satu
 * baris per split bila dipecah, selain itu satu baris dari kategori dan nominal transaksinya. Jumlah baris
 * per transaksi sama dengan nominalnya karena trigger deferred transaction_splits_sum.
 */
export const categoryLines = new QueryBuilder()
  .select({
    transactionId: sql<string>`${transactions.id}`.as("line_transaction_id"),
    categoryId: sql<string>`coalesce(${transactionSplits.categoryId}, ${transactions.categoryId})`.as("line_category_id"),
    amount: sql<bigint>`coalesce(${transactionSplits.amount}, ${transactions.amount})`.as("line_amount"),
    kind: sql<"income" | "expense">`${transactions.kind}`.as("line_kind"),
    occurredAt: sql<string>`${transactions.occurredAt}`.as("line_occurred_at"),
    accountId: sql<string>`${transactions.accountId}`.as("line_account_id"),
    /** Pemilik akun asal; null = Bersama. */
    ownerId: sql<string | null>`${accounts.ownerId}`.as("line_owner_id"),
  })
  .from(transactions)
  .innerJoin(accounts, transactionJoins.fromAccount)
  .innerJoin(lineMainCategories, eq(lineMainCategories.id, transactions.categoryId))
  .leftJoin(transactionSplits, eq(transactionSplits.transactionId, transactions.id))
  .where(and(countableTransaction(), ne(transactions.kind, "transfer"), sql`not ${lineMainCategories.isSystem}`))
  .as("category_lines");

/** Baris kategori dari akun di cakupan; Bersama hanya di Gabungan, sama dengan accountInScope. */
export function lineInScope(viewer: Viewer, scope: Scope): SQL {
  return ownerInScope(sql`${categoryLines.ownerId}`, viewer, scope);
}

/** Rentang waktu [start, end) atas baris kategori. */
export function lineInRange(range: { start: Date; end: Date }): SQL {
  return sql`${categoryLines.occurredAt} >= ${range.start.toISOString()}::timestamptz and ${categoryLines.occurredAt} < ${range.end.toISOString()}::timestamptz`;
}

/** Baris kategori milik satu pemilik akun; null = Bersama. */
export function lineOwnedBy(ownerId: string | null): SQL {
  return ownerId === null ? sql`${categoryLines.ownerId} is null` : sql`${categoryLines.ownerId} = ${ownerId}::uuid`;
}

/** Transaksi yang punya baris (kategori utama atau split) di salah satu kategori ini atau anaknya. */
export function transactionHasCategory(categoryIds: string[]): SQL {
  const ids = sql.join(categoryIds.map((id) => sql`${id}::uuid`), sql`, `);
  return sql`exists (
    select 1 from ${categories} hc
    where (hc.id in (${ids}) or hc.parent_id in (${ids}))
      and (hc.id = ${transactions.categoryId}
        or exists (select 1 from ${transactionSplits} hs where hs.transaction_id = ${transactions.id} and hs.category_id = hc.id))
  )`;
}
