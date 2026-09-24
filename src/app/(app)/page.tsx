import Link from "next/link";
import { parseScope, type Scope } from "@/lib/scope";
import { AccountsSection } from "@/components/dashboard/accounts-section";
import { buildAttentionItems } from "@/components/dashboard/attention-items";
import { AttentionList } from "@/components/dashboard/attention-list";
import { BillsSection, GoalsSection } from "@/components/dashboard/bills-goals";
import { BudgetSection } from "@/components/dashboard/budget-section";
import { CategorySection } from "@/components/dashboard/category-section";
import { FlowSection } from "@/components/dashboard/flow-section";
import { HealthSection } from "@/components/dashboard/health-section";
import { Hero } from "@/components/dashboard/hero";
import { heroLabel } from "@/components/dashboard/hero-label";
import { InsightsSection } from "@/components/dashboard/insights-section";
import type { People } from "@/components/dashboard/people";
import { RecordForPartnerButton } from "@/components/dashboard/record-for-partner";
import { ScopeCrossfade } from "@/components/dashboard/scope-crossfade";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireViewer } from "@/server/auth/session";
import { savingsRate } from "@/server/metrics/savings-rate";
import { getDashboard, type Dashboard } from "@/server/queries/dashboard";
import { flowsByOwner, getWeeklyInsights, scopeHasTransactions } from "@/server/queries/reports-dashboard";

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

  const d = await getDashboard(viewer, scope);

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
          Mulai dari rekening yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti.
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
    <Hero label={heroLabel(scope, partnerName, d.daysToPayday.value)} safe={d.safeToSpend} payday={d.daysToPayday} />
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
    <ScopeCrossfade scope={scope}>
      {hero}
      <AttentionList items={buildAttentionItems(d.attention, scope)} />
      <FlowSection d={d} previousRate={previousSavingsRate(d)} ownerFlows={ownerFlows} people={people} />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        <BudgetSection budgets={d.topBudgets} scope={scope} className="lg:col-span-5" />
        <CategorySection
          categories={d.categories}
          scope={scope}
          people={people}
          range={d.ranges.current}
          className="lg:col-span-7"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <BillsSection bills={d.upcomingBills} scope={scope} people={people} />
        <GoalsSection goals={d.activeGoals} scope={scope} people={people} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        <AccountsSection
          accounts={d.accounts}
          liquid={d.liquid}
          liabilities={d.liabilities}
          netWorth={d.netWorth}
          scope={scope}
          people={people}
          className="lg:col-span-7"
        />
        <HealthSection checks={d.health} className="lg:col-span-5" />
      </div>
      <InsightsSection insights={insights} />
    </ScopeCrossfade>
  );
}
