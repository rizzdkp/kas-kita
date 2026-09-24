import { and, eq, inArray, isNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { accounts, transactions } from "@/server/db/schema";

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
