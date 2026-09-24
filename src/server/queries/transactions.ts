import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { SCOPES } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, tags, transactionTags, transactions, users, TRANSACTION_KINDS } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { addDaysKey, startOfKey } from "@/server/metrics/_time";
import { getHistory, type HistoryEntry } from "./audit";
import { toAccounts, transactionFlow, transactionInScope, transactionJoins, type CashFlow } from "./scope";

const parentCategories = alias(categories, "parent_categories");
const creators = alias(users, "creators");

// "Baru dihapus" hanya menampilkan 30 hari terakhir; setelahnya job harian menghapus permanen
export const RESTORE_WINDOW_DAYS = 30;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const transactionFiltersSchema = z.object({
  scope: z.enum(SCOPES),
  accountIds: z.array(z.uuid()).optional(),
  categoryIds: z.array(z.uuid()).optional(),
  kinds: z.array(z.enum(TRANSACTION_KINDS)).optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
  createdBy: z.array(z.uuid()).optional(),
  tagIds: z.array(z.uuid()).optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(["confirmed", "draft"]).optional(),
  deleted: z.boolean().optional(),
  /** Sembunyikan transfer yang kedua ujungnya di cakupan (tampilan arus kas). */
  hideInternalTransfers: z.boolean().optional(),
});
export type TransactionFilters = z.input<typeof transactionFiltersSchema>;

export interface TransactionListRow {
  id: string;
  kind: "income" | "expense" | "transfer";
  flow: CashFlow;
  amount: bigint;
  occurredAt: Date;
  note: string | null;
  beneficiary: "owner" | "partner_of_owner" | "shared";
  status: "confirmed" | "draft";
  source: string;
  accountId: string;
  accountName: string;
  /** Pemilik transaksi = pemilik akun asal; null = Bersama. */
  ownerId: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  toOwnerId: string | null;
  /** Nama akun lawan untuk "Transfer keluar/masuk" di cakupan Saya/Partner. */
  counterpartyAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  parentCategoryName: string | null;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  version: number;
  deletedAt: Date | null;
  tags: Array<{ id: string; name: string }>;
}

export interface TransactionPage {
  rows: TransactionListRow[];
  nextCursor: string | null;
}

function encodeCursor(row: { occurredAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify([row.occurredAt.toISOString(), row.id])).toString("base64url");
}

function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
  const parsed = z
    .tuple([z.iso.datetime(), z.uuid()])
    .safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  if (!parsed.success) throw new ValidationError("Cursor halaman tidak valid");
  return { occurredAt: new Date(parsed.data[0]), id: parsed.data[1] };
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function selectFields(viewer: Viewer, scope: TransactionFilters["scope"]) {
  return {
    id: transactions.id,
    kind: transactions.kind,
    flow: transactionFlow(viewer, scope),
    amount: transactions.amount,
    occurredAt: transactions.occurredAt,
    note: transactions.note,
    beneficiary: transactions.beneficiary,
    status: transactions.status,
    source: transactions.source,
    accountId: transactions.accountId,
    accountName: accounts.name,
    ownerId: accounts.ownerId,
    toAccountId: transactions.toAccountId,
    toAccountName: toAccounts.name,
    toOwnerId: toAccounts.ownerId,
    categoryId: transactions.categoryId,
    categoryName: categories.name,
    categoryIcon: categories.icon,
    parentCategoryName: parentCategories.name,
    createdBy: transactions.createdBy,
    createdByName: creators.displayName,
    updatedBy: transactions.updatedBy,
    version: transactions.version,
    deletedAt: transactions.deletedAt,
  };
}

function baseQuery(db: DbOrTx, viewer: Viewer, scope: TransactionFilters["scope"]) {
  return db
    .select(selectFields(viewer, scope))
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parentCategories, eq(parentCategories.id, categories.parentId))
    .innerJoin(creators, eq(creators.id, transactions.createdBy))
    .$dynamic();
}

function filterConditions(viewer: Viewer, f: z.output<typeof transactionFiltersSchema>, now: Date): SQL[] {
  const conds: SQL[] = [transactionInScope(viewer, f.scope)];
  if (f.deleted) {
    conds.push(isNotNull(transactions.deletedAt));
    conds.push(gte(transactions.deletedAt, new Date(now.getTime() - RESTORE_WINDOW_DAYS * 86_400_000)));
  } else {
    conds.push(isNull(transactions.deletedAt));
  }
  if (f.status) conds.push(eq(transactions.status, f.status));
  if (f.accountIds?.length) {
    conds.push(or(inArray(transactions.accountId, f.accountIds), inArray(transactions.toAccountId, f.accountIds))!);
  }
  if (f.categoryIds?.length) {
    conds.push(or(inArray(transactions.categoryId, f.categoryIds), inArray(categories.parentId, f.categoryIds))!);
  }
  if (f.kinds?.length) conds.push(inArray(transactions.kind, f.kinds));
  if (f.from) conds.push(gte(transactions.occurredAt, startOfKey(f.from)));
  if (f.to) conds.push(lt(transactions.occurredAt, startOfKey(addDaysKey(f.to, 1))));
  if (f.createdBy?.length) conds.push(inArray(transactions.createdBy, f.createdBy));
  if (f.tagIds?.length) {
    conds.push(
      sql`exists (select 1 from ${transactionTags} tt where tt.transaction_id = ${transactions.id} and tt.tag_id in (${sql.join(
        f.tagIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}))`,
    );
  }
  if (f.q) {
    // ILIKE memakai index trigram di note (migrasi 0001)
    const pattern = `%${escapeLike(f.q)}%`;
    conds.push(
      or(
        sql`${transactions.note} ilike ${pattern}`,
        sql`${categories.name} ilike ${pattern}`,
        sql`${accounts.name} ilike ${pattern}`,
      )!,
    );
  }
  if (f.hideInternalTransfers) conds.push(sql`${transactionFlow(viewer, f.scope)} <> 'transfer_internal'`);
  return conds;
}

async function attachTags<T extends { id: string }>(rows: T[], db: DbOrTx): Promise<Array<T & { tags: Array<{ id: string; name: string }> }>> {
  if (rows.length === 0) return [];
  const tagRows = await db
    .select({ transactionId: transactionTags.transactionId, id: tags.id, name: tags.name })
    .from(transactionTags)
    .innerJoin(tags, eq(tags.id, transactionTags.tagId))
    .where(inArray(transactionTags.transactionId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    ...r,
    tags: tagRows.filter((t) => t.transactionId === r.id).map((t) => ({ id: t.id, name: t.name })),
  }));
}

function withCounterparty<R extends { flow: CashFlow; accountName: string; toAccountName: string | null }>(r: R) {
  const counterpartyAccountName =
    r.flow === "transfer_out" ? r.toAccountName : r.flow === "transfer_in" ? r.accountName : null;
  return { ...r, counterpartyAccountName };
}

/** Daftar F-HIST-1 dengan pagination keyset (occurred_at desc, id desc). */
export async function listTransactions(
  viewer: Viewer,
  filters: TransactionFilters,
  page: { cursor?: string | null; limit?: number } = {},
  db: DbOrTx = defaultDb,
  now: Date = new Date(),
): Promise<TransactionPage> {
  const f = transactionFiltersSchema.parse(filters);
  const limit = Math.min(Math.max(page.limit ?? 50, 1), 200);
  const conds = filterConditions(viewer, f, now);
  if (page.cursor) {
    const c = decodeCursor(page.cursor);
    conds.push(
      or(lt(transactions.occurredAt, c.occurredAt), and(eq(transactions.occurredAt, c.occurredAt), lt(transactions.id, c.id)))!,
    );
  }
  const rows = await baseQuery(db, viewer, f.scope)
    .where(and(...conds))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  const withTags = await attachTags(pageRows.map(withCounterparty), db);
  const last = pageRows[pageRows.length - 1];
  return {
    rows: withTags as TransactionListRow[],
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}

export interface TransactionDetail extends TransactionListRow {
  createdAt: Date;
  updatedAt: Date;
  updatedByName: string;
  history: HistoryEntry[];
}

/** Detail dengan riwayat audit (F-HIST-2). Detail tidak dibatasi cakupan karena data rumah tangga. */
export async function getTransaction(viewer: Viewer, id: string, db: DbOrTx = defaultDb): Promise<TransactionDetail> {
  const [row] = await baseQuery(db, viewer, "all")
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) throw new NotFoundError("transactions", id);
  const [meta] = await db
    .select({ createdAt: transactions.createdAt, updatedAt: transactions.updatedAt, updatedByName: users.displayName })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.updatedBy))
    .where(eq(transactions.id, id));
  const [withTags] = await attachTags([withCounterparty(row)], db);
  return {
    ...(withTags as TransactionListRow),
    createdAt: meta!.createdAt,
    updatedAt: meta!.updatedAt,
    updatedByName: meta!.updatedByName,
    history: await getHistory("transactions", id, db),
  };
}

/** Jumlah draf menunggu konfirmasi di cakupan (kotak "Perlu dikonfirmasi"). */
export async function countDrafts(viewer: Viewer, scope: TransactionFilters["scope"], db: DbOrTx = defaultDb): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .where(and(transactionInScope(viewer, scope), eq(transactions.status, "draft"), isNull(transactions.deletedAt)));
  return row?.n ?? 0;
}

/** Akun dan kategori terakhir yang dipakai user, untuk default form (F-IN-1 AC2). */
export async function getLastUsedDefaults(
  viewer: Viewer,
  scope: TransactionFilters["scope"],
  db: DbOrTx = defaultDb,
): Promise<{ accountId: string | null; categoryId: string | null }> {
  const [row] = await db
    .select({ accountId: transactions.accountId, categoryId: transactions.categoryId })
    .from(transactions)
    .innerJoin(accounts, transactionJoins.fromAccount)
    .leftJoin(toAccounts, transactionJoins.toAccount)
    .where(
      and(
        eq(transactions.createdBy, viewer.user.id),
        isNull(transactions.deletedAt),
        eq(transactions.kind, "expense"),
        transactionInScope(viewer, scope),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);
  return { accountId: row?.accountId ?? null, categoryId: row?.categoryId ?? null };
}
