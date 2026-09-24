import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, institutions, type AccountType } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";
import { accountGroup, type AccountBalanceInput, type AccountGroup } from "@/server/metrics/types";
import { getAccountBalance, getAccountBalances } from "./balances";
import { accountInScope, accountVisibleOnAccountsPage } from "./scope";

export interface AccountWithBalance extends AccountBalanceInput {
  group: AccountGroup;
  institutionId: string | null;
  institutionName: string | null;
  institutionSlug: string | null;
  openingBalance: bigint;
  openingDate: string;
  allowNegative: boolean;
  creditLimit: bigint | null;
  statementDay: number | null;
  dueDay: number | null;
  lastReconciledAt: Date | null;
  archivedAt: Date | null;
  sortOrder: number;
  version: number;
  /** Nilai pasar terakhir (investasi) dan tanggalnya. */
  marketValue: bigint | null;
  valuedOn: string | null;
  hasTransactions: boolean;
}

export interface AccountGroups {
  liquid: AccountWithBalance[];
  liability: AccountWithBalance[];
  asset: AccountWithBalance[];
  all: AccountWithBalance[];
}

export interface ListAccountsOptions {
  scope: Scope;
  /** "scope" = aturan cakupan murni (dashboard); "accounts_page" = akun Bersama selalu ikut. */
  view?: "scope" | "accounts_page";
  includeArchived?: boolean;
  /** Kunci hari WIB; saldo per akhir hari itu. */
  asOf?: string;
}

const accountColumns = {
  id: accounts.id,
  name: accounts.name,
  type: accounts.type,
  ownerId: accounts.ownerId,
  institutionId: accounts.institutionId,
  institutionName: institutions.name,
  institutionSlug: institutions.slug,
  openingBalance: accounts.openingBalance,
  openingDate: accounts.openingDate,
  allowNegative: accounts.allowNegative,
  creditLimit: accounts.creditLimit,
  statementDay: accounts.statementDay,
  dueDay: accounts.dueDay,
  lastReconciledAt: accounts.lastReconciledAt,
  archivedAt: accounts.archivedAt,
  sortOrder: accounts.sortOrder,
  version: accounts.version,
  hasTransactions: sql<boolean>`exists (select 1 from transactions t where t.account_id = ${accounts.id} or t.to_account_id = ${accounts.id})`,
  marketValue: sql<bigint | null>`(select v.market_value from investment_valuations v where v.account_id = ${accounts.id} and v.deleted_at is null order by v.valued_on desc, v.created_at desc limit 1)`,
  valuedOn: sql<string | null>`(select v.valued_on::text from investment_valuations v where v.account_id = ${accounts.id} and v.deleted_at is null order by v.valued_on desc, v.created_at desc limit 1)`,
};

type AccountRow = { [K in keyof typeof accountColumns]: unknown } & {
  id: string;
  name: string;
  type: AccountType;
  ownerId: string | null;
};

function toAccount(r: AccountRow, balance: bigint): AccountWithBalance {
  const row = r as unknown as Omit<AccountWithBalance, "balance" | "value" | "group">;
  const marketValue = row.marketValue === null ? null : BigInt(row.marketValue);
  return {
    ...row,
    marketValue,
    hasTransactions: Boolean(row.hasTransactions),
    group: accountGroup(row.type),
    balance,
    value: row.type === "investment" && marketValue !== null ? marketValue : balance,
  };
}

export function groupAccounts(list: AccountWithBalance[]): AccountGroups {
  return {
    liquid: list.filter((a) => a.group === "liquid"),
    liability: list.filter((a) => a.group === "liability"),
    asset: list.filter((a) => a.group === "asset"),
    all: list,
  };
}

/** Saldo dihitung query agregat, bukan materialized view (docs/decisions/0004). */
export async function listAccounts(viewer: Viewer, opts: ListAccountsOptions, db: DbOrTx = defaultDb): Promise<AccountGroups> {
  const visible =
    opts.view === "accounts_page" ? accountVisibleOnAccountsPage(viewer, opts.scope) : accountInScope(viewer, opts.scope);
  const rows = await db
    .select(accountColumns)
    .from(accounts)
    .leftJoin(institutions, eq(institutions.id, accounts.institutionId))
    .where(and(isNull(accounts.deletedAt), visible, opts.includeArchived ? undefined : isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name));
  const balances = await getAccountBalances({ accountIds: rows.map((r) => r.id), asOf: opts.asOf }, db);
  return groupAccounts(rows.map((r) => toAccount(r as AccountRow, balances.get(r.id) ?? 0n)));
}

export async function getAccount(accountId: string, db: DbOrTx = defaultDb): Promise<AccountWithBalance> {
  const [row] = await db
    .select(accountColumns)
    .from(accounts)
    .leftJoin(institutions, eq(institutions.id, accounts.institutionId))
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
  if (!row) throw new NotFoundError("akun", accountId);
  return toAccount(row as AccountRow, await getAccountBalance(accountId, {}, db));
}

export async function listInstitutions(db: DbOrTx = defaultDb) {
  return db.select().from(institutions).orderBy(asc(institutions.name));
}

/** Pratinjau rekonsiliasi F-ACC-2: selisih saldo sebenarnya dengan saldo tercatat. */
export async function getReconcilePreview(
  accountId: string,
  actualBalance: bigint,
  db: DbOrTx = defaultDb,
): Promise<{ recorded: bigint; actual: bigint; difference: bigint; lastReconciledAt: Date | null }> {
  const account = await getAccount(accountId, db);
  return {
    recorded: account.balance,
    actual: actualBalance,
    difference: actualBalance - account.balance,
    lastReconciledAt: account.lastReconciledAt,
  };
}
