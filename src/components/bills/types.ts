import type { BillWithStatus } from "@/server/queries/bills";
import type { BillPaymentEntry } from "@/server/queries/planning-history";

export type BillItem = BillWithStatus & {
  /** Keterangan siklus cetak untuk tagihan kartu kredit (F-BILL-1 AC3). */
  cycleLabel: string | null;
  history: BillPaymentEntry[];
};

export type AccountOption = { id: string; label: string };

export type PaidItem = {
  id: string;
  billId: string;
  billName: string;
  ownerId: string | null;
  amount: bigint | null;
  paidAt: Date;
  accountName: string | null;
};
