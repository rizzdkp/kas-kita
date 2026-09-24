import { periodRange } from "@/lib/dates";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { occurrencesBefore } from "@/server/metrics/_rrule";
import { addDaysKey, keyOf } from "@/server/metrics/_time";
import type { PaydayPerson } from "@/server/metrics/days-to-payday";
import type { BillDueItem, GoalSetAsideItem, MandatoryBudgetItem } from "@/server/metrics/safe-to-spend";
import type { BillWithStatus } from "./bills";
import type { BudgetWithStatus } from "./budgets";
import type { GoalWithProgress } from "./goals";

/** Orang yang gajiannya dipakai cakupan: Saya, Partner, atau keduanya di Gabungan. */
export function paydayPeople(viewer: Viewer, scope: Scope): PaydayPerson[] {
  const toPerson = (u: Viewer["user"]): PaydayPerson => ({ userId: u.id, name: u.displayName, paydayDay: u.paydayDay });
  if (scope === "partner") return viewer.partner ? [toPerson(viewer.partner)] : [toPerson(viewer.user)];
  if (scope === "all" && viewer.partner) return [toPerson(viewer.user), toPerson(viewer.partner)];
  return [toPerson(viewer.user)];
}

/** Awal siklus gajian berjalan dari orang yang gajiannya paling dekat. */
export function cycleStartKey(people: PaydayPerson[], nearestUserIds: string[], now: Date): string {
  const person = people.find((p) => nearestUserIds.includes(p.userId)) ?? people[0]!;
  return keyOf(periodRange("payday_cycle", person.paydayDay, now).start);
}

/** Tagihan yang jatuh tempo sebelum gajian, termasuk yang sudah telat; kartu kredit hanya kejadian pertama. */
export function billsDueBefore(bills: BillWithStatus[], untilExclusive: string): BillDueItem[] {
  return bills.flatMap((b) => {
    const dates = b.creditCardAccountId
      ? b.nextDueOn < untilExclusive
        ? [b.nextDueOn]
        : []
      : occurrencesBefore(b.rrule, b.nextDueOn, untilExclusive);
    return dates.map((dueOn) => ({ billId: b.id, name: b.name, dueOn, amount: b.amount }));
  });
}

/** Tagihan setelah hari ini sampai akhir periode, untuk garis proyeksi grafik. */
export function scheduledBillOutflows(bills: BillWithStatus[], today: string, periodLast: string) {
  return billsDueBefore(bills, addDaysKey(periodLast, 1))
    .filter((b) => b.dueOn > today)
    .map((b) => ({ day: b.dueOn, amount: b.amount }));
}

/** Setoran bulanan yang dibutuhkan dikurangi setoran sejak awal siklus; tidak pernah negatif. */
export function goalSetAsides(goals: GoalWithProgress[]): GoalSetAsideItem[] {
  return goals.flatMap((g) => {
    if (g.requiredMonthly === null) return [];
    const planned = g.requiredMonthly - g.contributedSince;
    return planned > 0n ? [{ goalId: g.id, name: g.name, amount: planned }] : [];
  });
}

export function mandatoryRemaining(budgets: BudgetWithStatus[]): MandatoryBudgetItem[] {
  return budgets
    .filter((b) => b.isMandatory)
    .map((b) => ({ budgetId: b.id, name: b.categoryName, remaining: b.amount > b.spent ? b.amount - b.spent : 0n }));
}
