import type { BillWithStatus } from "@/server/queries/bills";
import type { BillPaymentEntry } from "@/server/queries/planning-history";

export type BillItem = BillWithStatus & {
  /** Keterangan siklus cetak untuk tagihan kartu kredit (F-BILL-1 AC3). */
  cycleLabel: string | null;
  history: BillPaymentEntry[];
};

import type { AccountType } from "@/server/db/schema";

export type AccountOption = {
  id: string;
  label: string;
  /** Untuk lencana institusi di pilihan akun. */
  institutionSlug?: string | null;
  institutionName?: string | null;
  type?: AccountType;
};

export function billAccountOption(a: { id: string; name: string; type: AccountType; institutionSlug: string | null; institutionName: string | null }): AccountOption {
  return { id: a.id, label: a.name, type: a.type, institutionSlug: a.institutionSlug, institutionName: a.institutionName };
}

export type PaidItem = {
  id: string;
  billId: string;
  billName: string;
  ownerId: string | null;
  amount: bigint | null;
  paidAt: Date;
  accountName: string | null;
};
