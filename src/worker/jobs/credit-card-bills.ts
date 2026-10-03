import { todayJakarta } from "@/lib/dates";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { advanceSettledCreditCardBills } from "@/server/mutations/bill-cycle";

export const JOB_CREDIT_CARD_BILLS = "bills.credit-card";

/** 01.00 WIB: nominal dihitung saat dibaca; job hanya memajukan periode kartu kredit bernominal nol yang sudah lewat. */
export async function handleCreditCardBillsJob(opts: { now?: Date; db?: DbOrTx } = {}): Promise<{ checked: number; advanced: number }> {
  return advanceSettledCreditCardBills(todayJakarta(opts.now ?? new Date()), opts.db ?? defaultDb);
}
