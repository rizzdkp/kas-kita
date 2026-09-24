import Link from "next/link";
import { parseScope, type Scope } from "@/lib/scope";
import { AccountsSection } from "@/components/dashboard/accounts-section";
import { buildAttentionItems } from "@/components/dashboard/attention-items";
import { AttentionList } from "@/components/dashboard/attention-list";
import { BillsSection, GoalsSection } from "@/components/dashboard/bills-goals";
import { BudgetSection } from "@/components/dashboard/budget-section";
import { CategorySection } from "@/components/dashboard/category-section";
import { BalanceSection } from "@/components/dashboard/balance-section";
import { HealthSection } from "@/components/dashboard/health-section";
import { Hero } from "@/components/dashboard/hero";
import { heroLabel } from "@/components/dashboard/hero-label";
import { InsightsSection } from "@/components/dashboard/insights-section";
import { MetricsSection } from "@/components/dashboard/metrics-section";
import type { People } from "@/components/dashboard/people";
import { parsePeriod, periodNoun } from "@/components/dashboard/period";
import { RecordForPartnerButton } from "@/components/dashboard/record-for-partner";
import { ScopeCrossfade } from "@/components/dashboard/scope-crossfade";
import { TrendCard } from "@/components/dashboard/trend-card";
import { formatRangeLabel } from "@/lib/dates";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireViewer } from "@/server/auth/session";
import { addDaysKey, monthEndKey, startOfKey } from "@/server/metrics/_time";
import { savingsRate } from "@/server/metrics/savings-rate";
import { getDashboard, type Dashboard } from "@/server/queries/dashboard";
import { flowsByOwner, getWeeklyInsights, scopeHasTransactions } from "@/server/queries/reports-dashboard";

// Kecil satu kolom urut UX-FLOWS 3; sedang dua kolom; besar 12 kolom diurutkan ulang lewat order
// supaya layar pertama 1440x900 memuat hero, arus, grafik saldo, dan satu baris kartu.
// >=1280: metrik dua baris supaya Perlu perhatian mengisi celah di bawah hero.
const AREA = {
  hero: "sm:col-span-2 lg:col-span-5 lg:order-1",
  attention: "sm:col-span-2 lg:col-span-12 lg:order-3 min-[1280px]:col-span-5",
  metrics: "sm:col-span-2 lg:col-span-7 lg:order-2 min-[1280px]:row-span-2",
  balance: "sm:col-span-2 lg:col-span-6 lg:order-4 min-[1280px]:col-span-5",
  budget: "lg:col-span-6 lg:order-6 min-[1280px]:col-span-4 min-[1280px]:order-7",
  category: "lg:col-span-6 lg:order-7 min-[1280px]:col-span-4 min-[1280px]:order-8",
  bills: "lg:col-span-6 lg:order-5 min-[1280px]:col-span-4",
  goals: "lg:col-span-6 lg:order-8 min-[1280px]:col-span-3 min-[1280px]:order-6",
  accounts: "lg:col-span-6 lg:order-9 min-[1280px]:col-span-4",
  trend: "sm:col-span-2 lg:col-span-12 lg:order-10 min-[1280px]:col-span-8",
  health: "lg:col-span-5 lg:order-11 min-[1280px]:col-span-4",
  insights: "sm:col-span-2 lg:col-span-7 lg:order-12 min-[1280px]:col-span-12",
} as const;

const GOALS_SHOWN = 4;
const BILLS_SHOWN = 4;

/** "1-31 Agu": rentang bulan anggaran dengan format yang sama dengan label periode lain. */
function monthLabel(month: string): string {
  const range = { start: startOfKey(month), end: startOfKey(addDaysKey(monthEndKey(month), 1)) };
  return formatRangeLabel(range as Parameters<typeof formatRangeLabel>[0]);
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Rasio tabungan periode pembanding dari angka yang sudah dihitung metrik perubahan. */
function previousSavingsRate(d: Dashboard): number | null {
  const label = d.ranges.previous.label;
  const income = d.incomeChange.inputs[label];
  const expense = d.expenseChange.inputs[label];
  if (typeof income !== "bigint" || typeof expense !== "bigint") return null;
  return savingsRate(income, expense).value;
}

export default async function RingkasanPage({ searchParams }: PageProps) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const requested = parseScope(params.scope);
  const scope: Scope = viewer.partner ? requested : "me";
  const people: People = {
    me: { id: viewer.user.id, name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner
      ? { id: viewer.partner.id, name: viewer.partner.displayName, color: viewer.partner.identityColor }
      : null,
  };
  const partnerName = viewer.partner?.displayName ?? null;

  const period = parsePeriod(params.periode);
  const noun = periodNoun(viewer.user.periodMode === "calendar");
  const d = await getDashboard(viewer, scope, undefined, undefined, period);
  const lalu = d.period === "previous";

  if (d.accounts.all.length === 0 && scope !== "partner") {
    return (
      <Card>
        <EmptyState
          title="Tambahkan akun pertama"
          action={
            <Link href="/akun" className={buttonClassName("primary")}>
              Tambah akun
            </Link>
          }
        >
          Mulai dari akun yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti.
        </EmptyState>
      </Card>
    );
  }

  const [hasTransactions, ownerFlows, insights] = await Promise.all([
    scope === "partner" ? scopeHasTransactions(viewer, scope) : Promise.resolve(true),
    scope === "all" ? flowsByOwner(viewer, scope, d.ranges.current) : Promise.resolve(null),
    getWeeklyInsights(viewer, scope, { today: d.today, budgets: d.topBudgets, bills: d.upcomingBills }),
  ]);

  const hero = (
    <Hero
      label={heroLabel(scope, partnerName, d.daysToPayday.value)}
      safe={d.safeToSpend}
      payday={d.daysToPayday}
      todayNote={lalu}
    />
  );

  if (!hasTransactions && partnerName) {
    return (
      <ScopeCrossfade scope={scope}>
        {hero}
        <Card>
          <EmptyState title={`${partnerName} belum mencatat transaksi`} action={<RecordForPartnerButton name={partnerName} />}>
            Kamu bisa mencatat atas namanya dari sini.
          </EmptyState>
        </Card>
      </ScopeCrossfade>
    );
  }

  return (
    <ScopeCrossfade
      scope={`${scope}:${period}`}
      className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-12 lg:gap-4 min-[1280px]:gap-6"
    >
      <div className={`${AREA.hero} min-w-0`}>{hero}</div>
      <AttentionList items={buildAttentionItems(d.attention, scope)} className={`${AREA.attention} min-w-0`} />
      <MetricsSection
        d={d}
        previousRate={previousSavingsRate(d)}
        ownerFlows={ownerFlows}
        people={people}
        noun={noun}
        className={AREA.metrics}
      />
      <BalanceSection d={d} className={AREA.balance} />
      <BudgetSection
        budgets={d.topBudgets}
        scope={scope}
        pastMonth={lalu ? monthLabel(d.budgetMonth) : undefined}
        className={AREA.budget}
      />
      <CategorySection categories={d.categories} scope={scope} people={people} range={d.ranges.current} className={AREA.category} />
      <BillsSection bills={d.upcomingBills.slice(0, BILLS_SHOWN)} scope={scope} people={people} className={AREA.bills} />
      <GoalsSection goals={d.activeGoals.slice(0, GOALS_SHOWN)} scope={scope} people={people} className={AREA.goals} />
      <AccountsSection
        accounts={d.accounts}
        liquid={d.liquid}
        liabilities={d.liabilities}
        netWorth={d.netWorth}
        scope={scope}
        people={people}
        className={AREA.accounts}
      />
      <HealthSection checks={d.health} periodLabel={lalu ? d.ranges.current.label : undefined} className={AREA.health} />
      <TrendCard
        trend={d.trend}
        selected={(lalu ? d.budgetMonth : d.today).slice(0, 7)}
        scope={scope}
        className={AREA.trend}
      />
      <div className={`${AREA.insights} flex flex-col [&>*]:flex-1`}>
        <InsightsSection insights={insights} />
      </div>
    </ScopeCrossfade>
  );
}
