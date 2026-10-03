import { formatRupiah } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { ChartDataTable } from "@/components/charts/data-table";
import { TrendChart } from "@/components/charts/trend-chart";
import { formatMonthAxis, formatMonthLong } from "@/components/reports/months";
import { trendTitle } from "@/components/reports/trend-title";
import type { Metric } from "@/server/metrics/types";
import type { MonthFlow } from "@/server/queries/reports";
import { FormulaExplainer } from "./formula-explainer";
import { scopedHref } from "./links";
import { SeeAllLink } from "./see-all-link";
import { SectionCard } from "./section-card";

/** Tren 12 bulan versi ringkas; bulan periode terpilih ditebalkan. Rinciannya di Laporan. */
export function TrendCard({ trend, selected, scope, className }: { trend: Metric<MonthFlow[]>; selected: string; scope: Scope; className?: string }) {
  const title = trendTitle(trend.value);
  return (
    <SectionCard
      id="tren"
      className={className}
      title="Tren 12 bulan"
      action={
        <>
          <FormulaExplainer trigger="icon" title="Tren 12 bulan" items={[{ label: "Tren 12 bulan", formula: trend.formula, inputs: trend.inputs }]} />
          <SeeAllLink href={scopedHref("/laporan", scope)}>Buka Laporan</SeeAllLink>
        </>
      }
    >
      <div className="-mt-2 flex flex-col gap-3">
        <p className="text-small text-secondary">{title}</p>
        <TrendChart
          selected={selected}
          summary={title}
          className="h-56 lg:h-72"
          points={trend.value.map((t) => ({
            month: t.month,
            axisLabel: formatMonthAxis(t.month),
            label: formatMonthLong(t.month),
            income: t.income,
            expense: t.expense,
          }))}
        />
        <ChartDataTable
          caption="Pemasukan dan pengeluaran 12 bulan"
          columns={[{ label: "Bulan" }, { label: "Pemasukan", numeric: true }, { label: "Pengeluaran", numeric: true }, { label: "Selisih", numeric: true }]}
          rows={trend.value.map((t) => ({
            key: t.month,
            cells: [formatMonthLong(t.month), formatRupiah(t.income), formatRupiah(t.expense), formatRupiah(t.income - t.expense)],
          }))}
        />
      </div>
    </SectionCard>
  );
}
