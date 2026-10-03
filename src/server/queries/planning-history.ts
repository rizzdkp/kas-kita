import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, billPayments, goalContributions, transactions, users } from "@/server/db/schema";

export interface BillPaymentEntry {
  id: string;
  billId: string;
  periodStart: string;
  paidAt: Date;
  transactionId: string | null;
  /** Nominal dari transaksinya; null kalau transaksinya sudah dihapus permanen. */
  amount: bigint | null;
  accountName: string | null;
}

/** Riwayat pembayaran beberapa tagihan sekaligus, terbaru dulu. */
export async function listBillPaymentHistory(
  billIds: string[],
  opts: { limitPerBill?: number } = {},
  db: DbOrTx = defaultDb,
): Promise<Map<string, BillPaymentEntry[]>> {
  const out = new Map<string, BillPaymentEntry[]>();
  if (billIds.length === 0) return out;
  const rows = await db
    .select({
      id: billPayments.id,
      billId: billPayments.billId,
      periodStart: billPayments.periodStart,
      paidAt: billPayments.paidAt,
      transactionId: billPayments.transactionId,
      amount: transactions.amount,
      accountName: accounts.name,
    })
    .from(billPayments)
    .leftJoin(transactions, eq(transactions.id, billPayments.transactionId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(inArray(billPayments.billId, billIds))
    .orderBy(desc(billPayments.paidAt));
  const limit = opts.limitPerBill ?? 12;
  for (const r of rows) {
    const list = out.get(r.billId) ?? [];
    if (list.length < limit) list.push({ ...r, amount: r.amount === null ? null : BigInt(r.amount) });
    out.set(r.billId, list);
  }
  return out;
}

export interface GoalContributionEntry {
  id: string;
  goalId: string;
  amount: bigint;
  contributedAt: Date;
  createdByName: string;
  version: number;
}

/** Setoran manual beberapa target, terbaru dulu. */
export async function listGoalContributions(
  goalIds: string[],
  db: DbOrTx = defaultDb,
): Promise<Map<string, GoalContributionEntry[]>> {
  const out = new Map<string, GoalContributionEntry[]>();
  if (goalIds.length === 0) return out;
  const rows = await db
    .select({
      id: goalContributions.id,
      goalId: goalContributions.goalId,
      amount: goalContributions.amount,
      contributedAt: goalContributions.contributedAt,
      createdByName: users.displayName,
      version: goalContributions.version,
    })
    .from(goalContributions)
    .innerJoin(users, eq(users.id, goalContributions.createdBy))
    .where(and(inArray(goalContributions.goalId, goalIds), isNull(goalContributions.deletedAt)))
    .orderBy(desc(goalContributions.contributedAt));
  for (const r of rows) {
    const list = out.get(r.goalId) ?? [];
    list.push(r);
    out.set(r.goalId, list);
  }
  return out;
}
