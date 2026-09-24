import type { Metadata } from "next";
import { BudgetSummary } from "@/components/budgets/budget-summary";
import { BudgetsView } from "@/components/budgets/budgets-view";
import { ForecastCard } from "@/components/budgets/forecast-card";
import { MonthNav, monthLabel, shiftMonth } from "@/components/budgets/month-nav";
import { planningPeople } from "@/components/budgets/people";
import { formatShortDate, parseDateKey, todayJakarta } from "@/lib/dates";
import { parseScope, type Scope } from "@/lib/scope";
import { requireViewer } from "@/server/auth/session";
import { diffDaysKey, monthEndKey } from "@/server/metrics/_time";
import { listBudgets } from "@/server/queries/budgets";
import { listCategories } from "@/server/queries/categories";
import { getMonthEndForecast } from "@/server/queries/forecast";

export const metadata: Metadata = { title: "Anggaran" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseMonth(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}

function hrefFor(scope: Scope) {
  return (month: string) => {
    const params = new URLSearchParams({ bulan: month });
    if (scope !== "me") params.set("scope", scope);
    return `/anggaran?${params.toString()}`;
  };
}

export default async function AnggaranPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const scope = viewer.partner ? parseScope(params.scope) : "me";
  const today = todayJakarta();
  const currentMonth = today.slice(0, 7);
  const month = parseMonth(params.bulan, currentMonth);
  const isCurrentMonth = month === currentMonth;
  const previousMonth = shiftMonth(month, -1);

  const [budgets, previousBudgets, categoryTree, forecast] = await Promise.all([
    listBudgets(viewer, scope, { month: `${month}-01`, today }),
    listBudgets(viewer, scope, { month: `${previousMonth}-01`, today }),
    listCategories({ kind: "expense" }),
    isCurrentMonth ? getMonthEndForecast(viewer, scope) : Promise.resolve(null),
  ]);

  const categories = categoryTree.flatMap((c) => [
    { id: c.id, label: c.name },
    ...c.children.map((child) => ({ id: child.id, label: `${child.name} (${c.name})` })),
  ]);
  const totalAmount = budgets.reduce((sum, b) => sum + b.amount, 0n);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0n);
  const monthLast = monthEndKey(`${month}-01`);
  const day = isCurrentMonth
    ? { elapsed: diffDaysKey(`${month}-01`, today) + 1, total: diffDaysKey(`${month}-01`, monthLast) + 1 }
    : null;
  const monthEndDate = parseDateKey(monthLast);

  return (
    <BudgetsView
      month={month}
      isCurrentMonth={isCurrentMonth}
      scope={scope}
      people={planningPeople(viewer)}
      budgets={budgets}
      categories={categories}
      copyFromLabel={previousBudgets.length > 0 ? monthLabel(previousMonth) : null}
      nav={<MonthNav month={month} currentMonth={currentMonth} hrefFor={hrefFor(scope)} />}
      summary={
        <div key="summary" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <BudgetSummary totalAmount={totalAmount} totalSpent={totalSpent} day={day} />
          {forecast ? <ForecastCard forecast={forecast} monthEndLabel={monthEndDate ? formatShortDate(monthEndDate) : monthLast} /> : null}
        </div>
      }
    />
  );
}
