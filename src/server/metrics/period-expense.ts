import type { PeriodTotalInput } from "./period-income";
import type { Metric } from "./types";

export function periodExpense(input: PeriodTotalInput): Metric<bigint> {
  return {
    value: input.total,
    formula: `Pengeluaran periode = jumlah transaksi Pengeluaran ${input.periodLabel}, tanpa transfer dan Penyesuaian saldo`,
    inputs: { "Jumlah transaksi": input.count, Total: input.total, Periode: input.periodLabel },
  };
}
