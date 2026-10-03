import { serializeMoney } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { addDaysKey, monthStartKey, startOfKey } from "@/server/metrics/_time";
import { categoryBreakdown } from "@/server/metrics/category-breakdown";
import { expenseByCategory } from "@/server/queries/aggregates";
import { listBills } from "@/server/queries/bills";
import { listBudgets } from "@/server/queries/budgets";
import { billPaymentTransactionIds, insightSourceTransactionIds } from "@/server/queries/insights";
import { selectFacts, type CollectedFact } from "./facts";
import { pickBillFact, pickBudgetFact, pickCategoryFact } from "./pick";
import { COMPARISON_WEEKS, WEEK_LENGTH_DAYS, weekEnd } from "./week";

export interface WeekWindow {
  /** Senin minggu yang dirangkum. */
  weekStart: string;
  /** Hari job berjalan; tagihan dihitung dari sini. */
  today: string;
}

function weekTotals(rows: Awaited<ReturnType<typeof expenseByCategory>>) {
  return categoryBreakdown(rows).value.map((c) => ({ categoryId: c.categoryId, name: c.name, total: c.total }));
}

/** Fakta minggu lalu untuk satu cakupan, sudah dipilih maksimal tiga (F-AI-2 AC1 dan AC3). */
export async function collectWeeklyFacts(viewer: Viewer, scope: Scope, w: WeekWindow, db: DbOrTx = defaultDb): Promise<CollectedFact[]> {
  const end = weekEnd(w.weekStart);
  const lastWeek = { start: startOfKey(w.weekStart), end: startOfKey(addDaysKey(w.weekStart, WEEK_LENGTH_DAYS)) };
  const before = { start: startOfKey(addDaysKey(w.weekStart, -WEEK_LENGTH_DAYS * COMPARISON_WEEKS)), end: lastWeek.start };

  const [nowRows, beforeRows, budgets, bills] = await Promise.all([
    expenseByCategory(viewer, scope, lastWeek, db),
    expenseByCategory(viewer, scope, before, db),
    listBudgets(viewer, scope, { month: end, today: end }, db),
    listBills(viewer, scope, { today: w.today }, db),
  ]);
  const totals = weekTotals(nowRows);
  const out: CollectedFact[] = [];

  const category = pickCategoryFact(totals, weekTotals(beforeRows));
  if (category) {
    const link = { categoryIds: [category.categoryId], from: w.weekStart, to: end };
    out.push({
      fact: { ...category, link },
      sourceTransactionIds: await insightSourceTransactionIds(viewer, scope, { range: lastWeek, categoryId: category.categoryId }, db),
    });
  }

  const budget = pickBudgetFact(
    budgets.map((b) => ({
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      ownerId: b.ownerId,
      isMandatory: b.isMandatory,
      state: b.status.value.state,
      usedPercent: b.status.value.usedPercent,
      elapsedPercent: b.status.value.elapsedPercent,
      fasterThanUsual: b.status.value.fasterThanUsual,
    })),
  );
  if (budget) {
    const month = monthStartKey(end);
    const range = { start: startOfKey(month), end: lastWeek.end };
    out.push({
      fact: { ...budget.fact, link: { categoryIds: [budget.fact.categoryId], from: month, to: end } },
      sourceTransactionIds: await insightSourceTransactionIds(
        viewer,
        scope,
        { range, categoryId: budget.fact.categoryId, ownerId: budget.budget.ownerId },
        db,
      ),
    });
  }

  const bill = pickBillFact(bills.filter((b) => !b.overdue), w.today);
  if (bill) {
    const link = bill.bill.categoryId ? { categoryIds: [bill.bill.categoryId] } : { q: bill.bill.name };
    out.push({ fact: { ...bill.fact, link }, sourceTransactionIds: await billPaymentTransactionIds(bill.bill.id, db) });
  }

  const weekIds = await insightSourceTransactionIds(viewer, scope, { range: lastWeek }, db);
  if (weekIds.length > 0) {
    const total = totals.reduce((s, c) => s + c.total, 0n);
    out.push({
      fact: { kind: "total_minggu", total: serializeMoney(total), count: weekIds.length, link: { kinds: ["expense"], from: w.weekStart, to: end } },
      sourceTransactionIds: weekIds,
    });
  }
  return selectFacts(out);
}
