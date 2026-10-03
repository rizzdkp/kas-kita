import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, billPayments, bills, categories } from "@/server/db/schema";
import { addDaysKey, addMonthsKey, diffDaysKey, startOfKey } from "@/server/metrics/_time";
import { sumTransfersInto } from "./aggregates";
import { getAccountBalance } from "./balances";
import { ownerInScope } from "./scope";

const payFrom = alias(accounts, "pay_from_accounts");
const cards = alias(accounts, "card_accounts");

export interface BillWithStatus {
  id: string;
  ownerId: string | null;
  name: string;
  /** Nominal yang harus dibayar; untuk kartu kredit dihitung dari siklus cetak tagihan (F-BILL-1 AC3). */
  amount: bigint;
  storedAmount: bigint;
  amountIsEstimate: boolean;
  payFromAccountId: string;
  payFromAccountName: string;
  categoryId: string | null;
  categoryName: string | null;
  creditCardAccountId: string | null;
  creditCardAccountName: string | null;
  rrule: string;
  nextDueOn: string;
  /** Negatif berarti telat. */
  daysUntilDue: number;
  overdue: boolean;
  lastPaidAt: Date | null;
  version: number;
}

/** Tanggal cetak tagihan terakhir sebelum jatuh tempo. */
export function statementDateFor(dueOn: string, statementDay: number): string {
  const sameMonth = addMonthsKey(`${dueOn.slice(0, 7)}-01`, 0, statementDay);
  return sameMonth < dueOn ? sameMonth : addMonthsKey(`${dueOn.slice(0, 7)}-01`, -1, statementDay);
}

/** Saldo utang saat cetak tagihan dikurangi pembayaran setelahnya; tidak pernah negatif. */
export async function creditCardStatementAmount(
  card: { id: string; statementDay: number | null },
  dueOn: string,
  db: DbOrTx = defaultDb,
): Promise<bigint> {
  if (card.statementDay === null) {
    const balance = await getAccountBalance(card.id, {}, db);
    return balance < 0n ? -balance : 0n;
  }
  const statementOn = statementDateFor(dueOn, card.statementDay);
  const balance = await getAccountBalance(card.id, { asOf: statementOn }, db);
  const owed = balance < 0n ? -balance : 0n;
  const paid = await sumTransfersInto(
    [card.id],
    { start: startOfKey(addDaysKey(statementOn, 1)), end: startOfKey(addDaysKey(dueOn, 1)) },
    db,
  );
  const remaining = owed - (paid.get(card.id) ?? 0n);
  return remaining > 0n ? remaining : 0n;
}

export async function listBills(
  viewer: Viewer,
  scope: Scope,
  opts: { today: string },
  db: DbOrTx = defaultDb,
): Promise<BillWithStatus[]> {
  const rows = await db
    .select({
      id: bills.id,
      ownerId: bills.ownerId,
      name: bills.name,
      storedAmount: bills.amount,
      amountIsEstimate: bills.amountIsEstimate,
      payFromAccountId: bills.payFromAccountId,
      payFromAccountName: payFrom.name,
      categoryId: bills.categoryId,
      categoryName: categories.name,
      creditCardAccountId: bills.creditCardAccountId,
      creditCardAccountName: cards.name,
      creditCardStatementDay: cards.statementDay,
      rrule: bills.rrule,
      nextDueOn: bills.nextDueOn,
      version: bills.version,
      lastPaidAtMs: sql<bigint | null>`(select (extract(epoch from max(bp.paid_at)) * 1000)::bigint from ${billPayments} bp where bp.bill_id = ${bills.id})`,
    })
    .from(bills)
    .innerJoin(payFrom, eq(payFrom.id, bills.payFromAccountId))
    .leftJoin(cards, eq(cards.id, bills.creditCardAccountId))
    .leftJoin(categories, eq(categories.id, bills.categoryId))
    .where(and(isNull(bills.deletedAt), ownerInScope(bills.ownerId, viewer, scope)))
    .orderBy(asc(bills.nextDueOn), asc(bills.name));

  return Promise.all(
    rows.map(async ({ creditCardStatementDay, lastPaidAtMs, ...b }) => {
      const amount = b.creditCardAccountId
        ? await creditCardStatementAmount({ id: b.creditCardAccountId, statementDay: creditCardStatementDay }, b.nextDueOn, db)
        : b.storedAmount;
      const daysUntilDue = diffDaysKey(opts.today, b.nextDueOn);
      return {
        ...b,
        amount,
        daysUntilDue,
        overdue: daysUntilDue < 0,
        lastPaidAt: lastPaidAtMs === null ? null : new Date(Number(lastPaidAtMs)),
      };
    }),
  );
}

export async function listBillPayments(billId: string, db: DbOrTx = defaultDb) {
  return db.select().from(billPayments).where(eq(billPayments.billId, billId)).orderBy(desc(billPayments.paidAt));
}
