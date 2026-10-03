import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, categories, recurringRules, transactions, users } from "@/server/db/schema";
import { describeRecurrence, frequencyOf, parseRecurrence, type RecurrenceFrequency } from "@/server/recurring/schedule";
import { parseTemplate, type RecurringTemplate } from "@/server/recurring/template";
import { ownerIdInScope } from "./scope";

export interface RecurringRuleItem {
  id: string;
  version: number;
  template: Omit<RecurringTemplate, "amount">;
  amount: bigint;
  /** Catatan, atau nama kategori kalau catatan kosong. */
  label: string;
  /** Pemilik dari akun (asal); null = Bersama. */
  ownerId: string | null;
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  rrule: string;
  frequency: RecurrenceFrequency;
  interval: number;
  recurrenceLabel: string;
  nextRunOn: string;
  autoConfirm: boolean;
  createdById: string;
  createdByName: string;
  /** Draf dari jadwal ini yang masih menunggu konfirmasi. */
  pendingDrafts: number;
}

/** Jadwal berulang di cakupan, dilihat dari pemilik akun asal (atau akun tujuan untuk transfer masuk). */
export async function listRecurringRules(viewer: Viewer, scope: Scope, db: DbOrTx = defaultDb): Promise<RecurringRuleItem[]> {
  const rows = await db
    .select({
      id: recurringRules.id,
      version: recurringRules.version,
      template: recurringRules.template,
      rrule: recurringRules.rrule,
      nextRunOn: recurringRules.nextRunOn,
      autoConfirm: recurringRules.autoConfirm,
      createdById: recurringRules.createdBy,
      createdByName: users.displayName,
    })
    .from(recurringRules)
    .innerJoin(users, eq(users.id, recurringRules.createdBy))
    .where(isNull(recurringRules.deletedAt))
    .orderBy(asc(recurringRules.nextRunOn), asc(recurringRules.createdAt));

  const parsed = rows.flatMap((r) => {
    const template = parseTemplate(r.template);
    return template ? [{ ...r, template }] : [];
  });
  if (parsed.length === 0) return [];

  const accountIds = [...new Set(parsed.flatMap((r) => [r.template.accountId, ...(r.template.toAccountId ? [r.template.toAccountId] : [])]))];
  const categoryIds = [...new Set(parsed.flatMap((r) => (r.template.categoryId ? [r.template.categoryId] : [])))];
  const [accountRows, categoryRows, pending] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name, ownerId: accounts.ownerId }).from(accounts).where(inArray(accounts.id, accountIds)),
    categoryIds.length
      ? db.select({ id: categories.id, name: categories.name, icon: categories.icon }).from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    db
      .select({ recurringId: transactions.recurringId, n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          inArray(
            transactions.recurringId,
            parsed.map((r) => r.id),
          ),
          eq(transactions.status, "draft"),
          isNull(transactions.deletedAt),
        ),
      )
      .groupBy(transactions.recurringId),
  ]);
  const accountById = new Map(accountRows.map((a) => [a.id, a]));
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));
  const pendingById = new Map(pending.map((p) => [p.recurringId, p.n]));

  return parsed.flatMap((r) => {
    const { amount, ...template } = r.template;
    const from = accountById.get(template.accountId);
    if (!from) return [];
    const to = template.toAccountId ? accountById.get(template.toAccountId) : undefined;
    const visible = ownerIdInScope(from.ownerId, viewer, scope) || (to !== undefined && ownerIdInScope(to.ownerId, viewer, scope));
    if (!visible) return [];
    const category = template.categoryId ? categoryById.get(template.categoryId) : undefined;
    let interval = 1;
    try {
      interval = parseRecurrence(r.rrule).interval;
    } catch {
      // RRULE rusak tetap tampil supaya bisa diubah atau dihapus
    }
    return [
      {
        id: r.id,
        version: r.version,
        template,
        amount: BigInt(amount),
        label: template.note ?? category?.name ?? "Transfer",
        ownerId: from.ownerId,
        accountName: from.name,
        toAccountName: to?.name ?? null,
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        rrule: r.rrule,
        frequency: frequencyOf(r.rrule),
        interval,
        recurrenceLabel: describeRecurrence(r.rrule, r.nextRunOn),
        nextRunOn: r.nextRunOn,
        autoConfirm: r.autoConfirm,
        createdById: r.createdById,
        createdByName: r.createdByName,
        pendingDrafts: pendingById.get(r.id) ?? 0,
      },
    ];
  });
}

/** Jadwal yang jatuh tempo sampai `today` untuk job harian; `onlyIds` membatasi ke jadwal tertentu (tes). */
export async function listDueRecurringRuleIds(today: string, db: DbOrTx = defaultDb, onlyIds?: string[]): Promise<string[]> {
  if (onlyIds && onlyIds.length === 0) return [];
  const rows = await db
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(and(isNull(recurringRules.deletedAt), lte(recurringRules.nextRunOn, today), onlyIds ? inArray(recurringRules.id, onlyIds) : undefined))
    .orderBy(asc(recurringRules.nextRunOn));
  return rows.map((r) => r.id);
}

/** Id semua pengguna rumah tangga (maksimal dua), urut dari yang pertama dibuat. */
export async function listHouseholdUserIds(db: DbOrTx = defaultDb): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt));
  return rows.map((r) => r.id);
}
