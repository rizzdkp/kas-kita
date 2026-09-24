import { percentOf } from "@/lib/money";
import { diffDaysKey, monthEndKey, monthStartKey } from "./_time";
import type { Metric } from "./types";

export type BudgetState = "on_track" | "near" | "over";

export const BUDGET_NEAR_PERCENT = 80;
// selisih poin persen terpakai vs persen hari berlalu sebelum diberi label laju (F-BUD-1 AC3)
export const BUDGET_PACE_GAP_POINTS = 15;

export interface BudgetStatus {
  state: BudgetState;
  remaining: bigint;
  usedPercent: number | null;
  elapsedPercent: number;
  fasterThanUsual: boolean;
}

export function budgetStatus(input: { amount: bigint; spent: bigint; month: string; today: string }): Metric<BudgetStatus> {
  const start = monthStartKey(input.month);
  const totalDays = diffDaysKey(start, monthEndKey(start)) + 1;
  const rawElapsed = diffDaysKey(start, input.today) + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, rawElapsed));
  const elapsedPercent = (elapsedDays / totalDays) * 100;
  const usedPercent = percentOf(input.spent, input.amount);
  const state: BudgetState =
    input.spent > input.amount ? "over" : (usedPercent ?? 0) >= BUDGET_NEAR_PERCENT ? "near" : "on_track";
  const fasterThanUsual =
    state !== "over" && usedPercent !== null && usedPercent - elapsedPercent > BUDGET_PACE_GAP_POINTS;
  return {
    value: { state, remaining: input.amount - input.spent, usedPercent, elapsedPercent, fasterThanUsual },
    formula:
      "Terpakai = pengeluaran kategori bulan ini / anggaran. Mendekati mulai 80%, lewat di atas 100%. Laju lebih cepat dari biasa kalau persen terpakai melebihi persen hari berlalu lebih dari 15 poin",
    inputs: {
      Anggaran: input.amount,
      Terpakai: input.spent,
      "Hari berlalu": elapsedDays,
      "Hari dalam bulan": totalDays,
    },
  };
}
