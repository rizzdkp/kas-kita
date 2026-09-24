import { formatRupiah } from "@/lib/money";
import { ChartDataTable } from "@/components/charts/data-table";
import { TrendChart } from "@/components/charts/trend-chart";
import { FormulaExplainer } from "@/components/dashboard/formula-explainer";
import { SectionCard } from "@/components/dashboard/section-card";
import type { Metric } from "@/server/metrics/types";
import type { MonthFlow } from "@/server/queries/reports";
import { formatMonthAxis, formatMonthLong } from "./months";

/** Judul menjawab pertanyaan: berapa bulan pengeluaran melebihi pemasukan. */
export function trendTitle(trend: MonthFlow[]): string {
  const active = trend.filter((t) => t.income > 0n || t.expense > 0n);
  if (active.length === 0) return "Belum ada transaksi 12 bulan terakhir";
  const deficit = active.filter((t) => t.expense > t.income).length;
  if (deficit === 0) return `Pemasukan lebih besar dari pengeluaran di semua ${active.length} bulan tercatat`;
  return `Pengeluaran melebihi pemasukan di ${deficit} dari ${active.length} bulan tercatat`;
}

export function TrendSection({ trend, month }: { trend: Metric<MonthFlow[]>; month: string }) {
  const title = trendTitle(trend.value);
  return (
    <SectionCard
      id="tren"
      title="Tren 12 bulan"
      action={<FormulaExplainer trigger="icon" title="Tren 12 bulan" items={[{ label: "Tren 12 bulan", formula: trend.formula, inputs: trend.inputs }]} />}
    >
      <h3 className="text-small font-medium text-primary">{title}</h3>
      <TrendChart
        selected={month}
        summary={title}
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
    </SectionCard>
  );
}
