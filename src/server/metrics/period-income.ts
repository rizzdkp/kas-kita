import type { Metric } from "./types";

export interface PeriodTotalInput {
  total: bigint;
  count: number;
  /** Label periode siap tampil, misalnya "1-24 Sep". */
  periodLabel: string;
}

export function periodIncome(input: PeriodTotalInput): Metric<bigint> {
  return {
    value: input.total,
    formula: `Pemasukan periode = jumlah transaksi Pemasukan ${input.periodLabel}, tanpa transfer dan Penyesuaian saldo`,
    inputs: { "Jumlah transaksi": input.count, Total: input.total, Periode: input.periodLabel },
  };
}
