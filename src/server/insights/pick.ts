import { percentOf, serializeMoney } from "@/lib/money";
import { diffDaysKey } from "@/server/metrics/_time";
import type { InsightFact } from "./facts";
import { COMPARISON_WEEKS, WEEK_LENGTH_DAYS } from "./week";

export interface CategoryWeekTotal {
  categoryId: string;
  name: string;
  total: bigint;
}

type CategoryFact = Extract<InsightFact, { kind: "kategori_naik" | "kategori_baru" }>;
type FactWithoutLink<F> = F extends InsightFact ? Omit<F, "link"> : never;

/** Rata-rata mingguan dibulatkan setengah ke atas; minimal Rp 1 kalau ada pengeluaran supaya persen terdefinisi. */
export function weeklyAverage(sumOfWeeks: bigint, weeks = COMPARISON_WEEKS): bigint {
  const avg = (sumOfWeeks * 2n + BigInt(weeks)) / (BigInt(weeks) * 2n);
  return sumOfWeeks > 0n && avg === 0n ? 1n : avg;
}

/** Kategori dengan kenaikan rupiah terbesar minggu lalu dibanding rata-rata 4 minggu sebelumnya. */
export function pickCategoryFact(lastWeek: CategoryWeekTotal[], previousWeeks: CategoryWeekTotal[]): FactWithoutLink<CategoryFact> | null {
  const before = new Map(previousWeeks.map((c) => [c.categoryId, c.total]));
  let best: { c: CategoryWeekTotal; previousSum: bigint; average: bigint; increase: bigint } | null = null;
  for (const c of lastWeek) {
    const previousSum = before.get(c.categoryId) ?? 0n;
    const average = weeklyAverage(previousSum);
    const increase = c.total - average;
    if (increase <= 0n) continue;
    if (!best || increase > best.increase || (increase === best.increase && c.name.localeCompare(best.c.name, "id") < 0)) {
      best = { c, previousSum, average, increase };
    }
  }
  if (!best) return null;
  if (best.previousSum === 0n) {
    return { kind: "kategori_baru", categoryId: best.c.categoryId, categoryName: best.c.name, current: serializeMoney(best.c.total) };
  }
  return {
    kind: "kategori_naik",
    categoryId: best.c.categoryId,
    categoryName: best.c.name,
    current: serializeMoney(best.c.total),
    average: serializeMoney(best.average),
    increasePercent: percentOf(best.increase, best.average) ?? 0,
  };
}

export interface BudgetPace {
  categoryId: string;
  categoryName: string;
  ownerId: string | null;
  isMandatory: boolean;
  state: "on_track" | "near" | "over";
  usedPercent: number | null;
  elapsedPercent: number;
  fasterThanUsual: boolean;
}

type BudgetFact = Extract<InsightFact, { kind: "anggaran_lewat" | "anggaran_cepat" }>;

/** Anggaran wajib yang lewat (terpakai tertinggi), kalau tidak ada yang lajunya paling jauh di depan hari berlalu. */
export function pickBudgetFact(budgets: BudgetPace[]): { fact: FactWithoutLink<BudgetFact>; budget: BudgetPace } | null {
  const mandatory = budgets.filter((b) => b.isMandatory && b.usedPercent !== null);
  const over = mandatory.filter((b) => b.state === "over").sort((a, b) => b.usedPercent! - a.usedPercent!)[0];
  if (over) {
    return {
      fact: { kind: "anggaran_lewat", categoryId: over.categoryId, categoryName: over.categoryName, usedPercent: over.usedPercent! },
      budget: over,
    };
  }
  const fast = mandatory
    .filter((b) => b.fasterThanUsual)
    .sort((a, b) => b.usedPercent! - b.elapsedPercent - (a.usedPercent! - a.elapsedPercent))[0];
  if (!fast) return null;
  return {
    fact: {
      kind: "anggaran_cepat",
      categoryId: fast.categoryId,
      categoryName: fast.categoryName,
      usedPercent: fast.usedPercent!,
      elapsedPercent: fast.elapsedPercent,
    },
    budget: fast,
  };
}

export interface BillDue {
  id: string;
  name: string;
  amount: bigint;
  nextDueOn: string;
  categoryId: string | null;
}

/** Tagihan paling dekat yang jatuh tempo dalam 7 hari mulai hari job berjalan. */
export function pickBillFact(bills: BillDue[], today: string): { fact: FactWithoutLink<Extract<InsightFact, { kind: "tagihan" }>>; bill: BillDue } | null {
  const due = bills
    .filter((b) => {
      const days = diffDaysKey(today, b.nextDueOn);
      return days >= 0 && days < WEEK_LENGTH_DAYS;
    })
    .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn) || a.name.localeCompare(b.name, "id"))[0];
  if (!due) return null;
  return { fact: { kind: "tagihan", billId: due.id, name: due.name, amount: serializeMoney(due.amount), dueOn: due.nextDueOn }, bill: due };
}
