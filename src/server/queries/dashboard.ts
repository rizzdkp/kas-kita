import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { addDaysKey, addMonthsKey, keyOf, monthStartKey, startOfKey } from "@/server/metrics/_time";
import { categoryBreakdown, type CategoryTotal } from "@/server/metrics/category-breakdown";
import { cumulativeDailyBalance, type DailyPoint } from "@/server/metrics/cumulative-daily-balance";
import { daysToPayday, type DaysToPayday } from "@/server/metrics/days-to-payday";
import { healthChecks, type HealthCheck } from "@/server/metrics/health-checks";
import { liabilities } from "@/server/metrics/liabilities";
import { liquidBalance } from "@/server/metrics/liquid-balance";
import { netWorth } from "@/server/metrics/net-worth";
import { comparableRanges, periodComparison, type ComparableRanges } from "@/server/metrics/period-comparison";
import { periodExpense } from "@/server/metrics/period-expense";
import { periodIncome } from "@/server/metrics/period-income";
import { safeToSpend, type SafeToSpend } from "@/server/metrics/safe-to-spend";
import { savingsRate } from "@/server/metrics/savings-rate";
import type { Metric } from "@/server/metrics/types";
import { listAccounts, type AccountGroups } from "./accounts";
import { expenseByCategory, monthlyExpenseTotals, sumDebtPayments, sumFlows } from "./aggregates";
import { getAccountBalances, getDailyDeltas } from "./balances";
import { listBills, type BillWithStatus } from "./bills";
import { listBudgets, type BudgetWithStatus } from "./budgets";
import {
  billsDueBefore,
  cycleStartKey,
  goalSetAsides,
  mandatoryRemaining,
  paydayPeople,
  scheduledBillOutflows,
} from "./dashboard-inputs";
import { listGoals, type GoalWithProgress } from "./goals";
import { countDrafts } from "./transactions";

// bagian "Perlu perhatian": tagihan yang jatuh tempo dalam 3 hari (F-NOT-1, UX-FLOWS bagian 3)
const DUE_SOON_DAYS = 3;
const EMERGENCY_SAMPLE_MONTHS = 3;
const TOP_BUDGETS = 5;

export interface Dashboard {
  scope: Scope;
  today: string;
  ranges: ComparableRanges;
  daysToPayday: DaysToPayday;
  safeToSpend: SafeToSpend;
  accounts: AccountGroups;
  liquid: Metric<bigint>;
  liabilities: Metric<bigint>;
  netWorth: Metric<bigint>;
  income: Metric<bigint>;
  expense: Metric<bigint>;
  savingsRate: Metric<number | null>;
  incomeChange: Metric<number | null>;
  expenseChange: Metric<number | null>;
  dailyBalance: Metric<DailyPoint[]>;
  categories: Metric<CategoryTotal[]>;
  /** Lima anggaran dengan persen terpakai tertinggi. */
  topBudgets: BudgetWithStatus[];
  upcomingBills: BillWithStatus[];
  activeGoals: GoalWithProgress[];
  health: HealthCheck[];
  attention: {
    overdueBills: BillWithStatus[];
    dueSoonBills: BillWithStatus[];
    mandatoryOverBudgets: BudgetWithStatus[];
    draftCount: number;
  };
}

/** Semua angka halaman Ringkasan untuk satu cakupan; query independen berjalan paralel. */
export async function getDashboard(viewer: Viewer, scope: Scope, now: Date = new Date(), db: DbOrTx = defaultDb): Promise<Dashboard> {
  const today = keyOf(now);
  const people = paydayPeople(viewer, scope);
  const payday = daysToPayday(people, now);
  const ranges = comparableRanges(viewer.user.periodMode, viewer.user.paydayDay, now);
  const month = monthStartKey(today);
  const sampleStart = addMonthsKey(month, -EMERGENCY_SAMPLE_MONTHS, 1);
  const currentRange = { start: ranges.current.start, end: ranges.current.end };

  const [accounts, flows, previousFlows, categoryRows, budgets, bills, goals, debtPayments, monthly, draftCount] = await Promise.all([
    listAccounts(viewer, { scope }, db),
    sumFlows(viewer, scope, currentRange, db),
    sumFlows(viewer, scope, { start: ranges.previous.start, end: ranges.previous.end }, db),
    expenseByCategory(viewer, scope, currentRange, db),
    listBudgets(viewer, scope, { month, today }, db),
    listBills(viewer, scope, { today }, db),
    listGoals(viewer, scope, { today, contributedSince: cycleStartKey(people, payday.userIds, now) }, db),
    sumDebtPayments(viewer, scope, currentRange, db),
    monthlyExpenseTotals(viewer, scope, { start: startOfKey(sampleStart), end: startOfKey(month) }, db),
    countDrafts(viewer, scope, db),
  ]);

  const liquidIds = accounts.liquid.map((a) => a.id);
  const [startBalances, deltas] = await Promise.all([
    getAccountBalances({ accountIds: liquidIds, asOf: addDaysKey(ranges.period.from, -1) }, db),
    getDailyDeltas({ accountIds: liquidIds, from: ranges.period.from, to: today }, db),
  ]);

  const liquid = liquidBalance(accounts.all);
  let startBalance = 0n;
  for (const v of startBalances.values()) startBalance += v;

  const safe = safeToSpend({
    liquid: liquid.value,
    nextPayday: payday.nextPayday,
    billsDue: billsDueBefore(bills, payday.nextPayday),
    goalSetAsides: goalSetAsides(goals.active),
    mandatoryBudgets: mandatoryRemaining(budgets),
  });

  const sampled = monthly.filter((m) => m.total > 0n);
  const avgMonthlyExpense = sampled.length > 0 ? sampled.reduce((s, m) => s + m.total, 0n) / BigInt(sampled.length) : 0n;

  const topBudgets = [...budgets]
    .sort((a, b) => (b.status.value.usedPercent ?? 0) - (a.status.value.usedPercent ?? 0))
    .slice(0, TOP_BUDGETS);

  return {
    scope,
    today,
    ranges,
    daysToPayday: payday,
    safeToSpend: safe,
    accounts,
    liquid,
    liabilities: liabilities(accounts.all),
    netWorth: netWorth(accounts.all),
    income: periodIncome({ total: flows.income, count: flows.incomeCount, periodLabel: ranges.current.label }),
    expense: periodExpense({ total: flows.expense, count: flows.expenseCount, periodLabel: ranges.current.label }),
    savingsRate: savingsRate(flows.income, flows.expense),
    incomeChange: periodComparison(flows.income, previousFlows.income, ranges),
    expenseChange: periodComparison(flows.expense, previousFlows.expense, ranges),
    dailyBalance: cumulativeDailyBalance({
      startBalance,
      from: ranges.period.from,
      today,
      periodLast: ranges.period.to,
      deltas,
      scheduled: scheduledBillOutflows(bills, today, ranges.period.to),
    }),
    categories: categoryBreakdown(categoryRows),
    topBudgets,
    upcomingBills: bills.slice(0, 5),
    activeGoals: goals.active,
    health: healthChecks({
      liquid: liquid.value,
      avgMonthlyExpense,
      monthsSampled: sampled.length,
      income: flows.income,
      expense: flows.expense,
      debtPayments,
      overdueBills: bills.filter((b) => b.overdue).length,
    }),
    attention: {
      overdueBills: bills.filter((b) => b.overdue),
      dueSoonBills: bills.filter((b) => !b.overdue && b.daysUntilDue <= DUE_SOON_DAYS),
      mandatoryOverBudgets: budgets.filter((b) => b.isMandatory && b.status.value.state === "over"),
      draftCount,
    },
  };
}

