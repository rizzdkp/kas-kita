import { formatShortDate, parseDateKey } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { CumulativeBalanceChart } from "@/components/charts/cumulative-balance-chart";
import { ChartDataTable } from "@/components/charts/data-table";
import type { Dashboard } from "@/server/queries/dashboard";
import { FormulaExplainer } from "./formula-explainer";
import { SectionCard } from "./section-card";

function chartTitle(points: Dashboard["dailyBalance"]["value"], periodLabel: string): string {
  const last = points.at(-1);
  if (!last) return "Belum ada saldo untuk digambar";
  const amount = formatRupiah(last.balance);
  return last.projected ? `Saldo likuid diperkirakan ${amount} di akhir ${periodLabel}` : `Saldo likuid ${amount} di akhir ${periodLabel}`;
}

function dayText(key: string): string {
  const d = parseDateKey(key);
  return d ? formatShortDate(d) : key;
}

/** Saldo likuid kumulatif harian periode terpilih; judulnya kalimat jawaban, bukan nama grafik (F-DASH-1 AC2). */
export function BalanceSection({ d, className }: { d: Dashboard; className?: string }) {
  const points = d.dailyBalance.value;
  const title = chartTitle(points, d.ranges.period.label);
  const projected = points.some((p) => p.projected);
  return (
    <SectionCard
      id="saldo-harian"
      className={className}
      title={title}
      action={
        <FormulaExplainer
          trigger="icon"
          title="Saldo likuid harian"
          items={[{ label: "Saldo likuid harian", formula: d.dailyBalance.formula, inputs: d.dailyBalance.inputs }]}
        />
      }
    >
      <div className="-mt-2 flex flex-col gap-2">
        {projected ? (
          <p className="text-caption text-secondary">
            Garis putus-putus: proyeksi dari rata-rata pengeluaran harian dan tagihan terjadwal sampai {d.ranges.period.label}.
          </p>
        ) : null}
        <CumulativeBalanceChart points={points} summary={title} className="h-48 sm:h-52 lg:h-44" />
        <ChartDataTable
          caption={`Saldo likuid harian ${d.ranges.period.label}`}
          columns={[{ label: "Tanggal" }, { label: "Saldo likuid", numeric: true }, { label: "Keterangan" }]}
          rows={points.map((p) => ({
            key: p.day,
            cells: [dayText(p.day), formatRupiah(p.balance), p.projected ? "Proyeksi" : "Aktual"],
          }))}
        />
      </div>
    </SectionCard>
  );
}
