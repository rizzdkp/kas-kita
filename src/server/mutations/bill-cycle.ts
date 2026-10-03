import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, bills } from "@/server/db/schema";
import { nextOccurrence } from "@/server/metrics/_rrule";
import { creditCardStatementAmount } from "@/server/queries/bills";
import { listHouseholdUserIds } from "@/server/queries/recurring";
import { inTransaction } from "./_shared";
import { updateWithAudit } from "./audit";

/**
 * Job bills.credit-card (ARCHITECTURE 7). Nominal tagihan kartu kredit sudah dihitung saat dibaca
 * (listBills dan payBill memanggil creditCardStatementAmount), jadi bills.amount tidak disalin ulang.
 * Yang tidak bisa diselesaikan saat baca: periode yang lewat jatuh tempo dengan nominal nol (tidak ada
 * pemakaian, atau sudah dilunasi lewat transfer biasa) tidak akan pernah dibayar lewat "Bayar" karena
 * payBill menolak nominal nol. Periode itu dimajukan di sini supaya tidak tampil telat selamanya.
 */
export async function advanceSettledCreditCardBills(today: string, db: DbOrTx = defaultDb): Promise<{ checked: number; advanced: number }> {
  const due = await db
    .select({ id: bills.id })
    .from(bills)
    .where(and(isNull(bills.deletedAt), isNotNull(bills.creditCardAccountId), lt(bills.nextDueOn, today)));
  const fallbackActor = (await listHouseholdUserIds(db))[0];
  let advanced = 0;
  for (const { id } of due) {
    const moved = await inTransaction(db, async (tx) => {
      const [bill] = await tx.select().from(bills).where(eq(bills.id, id)).for("update");
      if (!bill || bill.deletedAt || !bill.creditCardAccountId || bill.nextDueOn >= today) return false;
      const [card] = await tx.select().from(accounts).where(eq(accounts.id, bill.creditCardAccountId));
      if (!card) return false;
      const actorId = bill.ownerId ?? fallbackActor;
      if (!actorId) return false;
      let next = bill.nextDueOn;
      // beberapa periode bisa tertinggal (worker mati); berhenti di periode pertama yang masih ada nominalnya
      for (let i = 0; i < 24 && next < today; i++) {
        if ((await creditCardStatementAmount(card, next, tx)) > 0n) break;
        next = nextOccurrence(bill.rrule, next);
      }
      if (next === bill.nextDueOn) return false;
      await updateWithAudit(tx, bills, { id: bill.id, expectedVersion: bill.version, actorId, values: { nextDueOn: next } });
      return true;
    });
    if (moved) advanced += 1;
  }
  return { checked: due.length, advanced };
}
