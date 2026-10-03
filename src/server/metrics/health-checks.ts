import { percentOf } from "@/lib/money";
import { savingsRate } from "./savings-rate";
import type { Metric } from "./types";

export type HealthState = "good" | "watch" | "attention";

export interface HealthCheck extends Metric<number | null> {
  key: "emergency_fund" | "savings_rate" | "debt_ratio" | "overdue_bills";
  label: string;
  state: HealthState;
}

export interface HealthInput {
  liquid: bigint;
  /** Rata-rata pengeluaran per bulan dari bulan penuh terakhir. */
  avgMonthlyExpense: bigint;
  monthsSampled: number;
  income: bigint;
  expense: bigint;
  /** Transfer masuk ke akun pinjaman dan PayLater periode ini. */
  debtPayments: bigint;
  overdueBills: number;
}

// ambang mengikuti patokan umum perencana keuangan; hanya dipakai untuk label, bukan skor tunggal
const EMERGENCY_GOOD_MONTHS = 3;
const SAVINGS_GOOD_PERCENT = 20;
const DEBT_WATCH_PERCENT = 30;

/** Empat pemeriksaan F-DASH-1 AC4, masing-masing dengan rumus; tidak ada skor gabungan. */
export function healthChecks(input: HealthInput): HealthCheck[] {
  const months =
    input.avgMonthlyExpense > 0n ? Number((input.liquid * 10n) / input.avgMonthlyExpense) / 10 : null;
  const rate = savingsRate(input.income, input.expense);
  const debt = percentOf(input.debtPayments, input.income);
  return [
    {
      key: "emergency_fund",
      label: "Dana darurat",
      value: months,
      state: months === null ? "watch" : months >= EMERGENCY_GOOD_MONTHS ? "good" : months >= 1 ? "watch" : "attention",
      formula: "Bulan pengeluaran tertutup = saldo likuid / rata-rata pengeluaran bulanan",
      inputs: {
        "Saldo likuid": input.liquid,
        "Rata-rata pengeluaran bulanan": input.avgMonthlyExpense,
        "Bulan yang dihitung": input.monthsSampled,
      },
    },
    {
      key: "savings_rate",
      label: "Rasio tabungan",
      value: rate.value,
      state: rate.value === null ? "watch" : rate.value >= SAVINGS_GOOD_PERCENT ? "good" : rate.value >= 0 ? "watch" : "attention",
      formula: rate.formula,
      inputs: rate.inputs,
    },
    {
      key: "debt_ratio",
      label: "Rasio cicilan",
      value: debt,
      state: debt === null ? (input.debtPayments > 0n ? "attention" : "good") : debt <= DEBT_WATCH_PERCENT ? "good" : "attention",
      formula: "Rasio cicilan = pembayaran ke akun pinjaman dan PayLater periode ini / pemasukan periode ini",
      inputs: { "Pembayaran cicilan": input.debtPayments, Pemasukan: input.income },
    },
    {
      key: "overdue_bills",
      label: "Tagihan lewat jatuh tempo",
      value: input.overdueBills,
      state: input.overdueBills === 0 ? "good" : "attention",
      formula: "Jumlah tagihan yang tanggal jatuh temponya sudah lewat dan belum dibayar",
      inputs: { "Tagihan telat": input.overdueBills },
    },
  ];
}
