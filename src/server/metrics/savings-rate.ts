import { percentOf } from "@/lib/money";
import type { Metric } from "./types";

/** Nilai dalam persen (30,8 berarti 30,8%); null berarti "Belum ada pemasukan periode ini". */
export function savingsRate(income: bigint, expense: bigint): Metric<number | null> {
  return {
    value: income === 0n ? null : percentOf(income - expense, income),
    formula: "Rasio tabungan = (pemasukan - pengeluaran) / pemasukan",
    inputs: { Pemasukan: income, Pengeluaran: expense, Selisih: income - expense },
  };
}
