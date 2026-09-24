import { formatShortDate, parseDateKey } from "@/lib/dates";
import { formatPercent, formatRupiah } from "@/lib/money";
import { CumulativeBalanceChart } from "@/components/charts/cumulative-balance-chart";
import { ChartDataTable } from "@/components/charts/data-table";
import { Amount } from "@/components/money/amount";
import { Delta } from "@/components/money/delta";
import type { Dashboard } from "@/server/queries/dashboard";
import type { OwnerFlow } from "@/server/queries/reports-dashboard";
import { FormulaExplainer } from "./formula-explainer";
import { OwnerSplit } from "./owner-split";
import type { People } from "./people";
import { SectionCard } from "./section-card";

type FlowSectionProps = {
  d: Dashboard;
  /** Rasio tabungan periode pembanding; null kalau pembanding tanpa pemasukan. */
  previousRate: number | null;
  ownerFlows: OwnerFlow[] | null;
  people: People;
};

function ChangeLine({ percent, comparedTo }: { percent: number | null; comparedTo: string }) {
  if (percent === null) return <span className="text-small text-secondary">Belum ada data {comparedTo}</span>;
  return <Delta percent={percent} comparedTo={comparedTo} />;
}

function PointsLine({ points, comparedTo }: { points: number; comparedTo: string }) {
  const arrow = points > 0 ? "↑ " : points < 0 ? "↓ " : "";
  const spoken = points > 0 ? "naik" : points < 0 ? "turun" : "tetap";
  const value = formatPercent(Math.abs(points)).replace("%", " poin");
  return (
    <span className="tabular text-small text-secondary">
      <span className="sr-only">{`${spoken} ${value} dari ${comparedTo}`}</span>
      <span aria-hidden>{`${arrow}${value} dari ${comparedTo}`}</span>
    </span>
  );
}

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

/** Arus periode berjalan: tiga angka dengan delta, lalu grafik saldo kumulatif (UX-FLOWS bagian 3.3). */
export function FlowSection({ d, previousRate, ownerFlows, people }: FlowSectionProps) {
  const prev = d.ranges.previous.label;
  const rate = d.savingsRate.value;
  const title = chartTitle(d.dailyBalance.value, d.ranges.period.label);
  const periodEnd = d.ranges.period.label;
  return (
    <SectionCard
      id="arus"
      title={
        <>
          {d.ranges.period.from.endsWith("-01") ? "Arus bulan ini" : "Arus periode ini"}
          <span className="ml-2 text-small font-normal text-secondary">{d.ranges.current.label}</span>
        </>
      }
      action={
        <FormulaExplainer
          trigger="icon"
          title="Arus bulan ini"
          items={[
            { label: "Pemasukan", formula: d.income.formula, inputs: d.income.inputs, result: formatRupiah(d.income.value) },
            { label: "Pengeluaran", formula: d.expense.formula, inputs: d.expense.inputs, result: formatRupiah(d.expense.value) },
            {
              label: "Rasio tabungan",
              formula: d.savingsRate.formula,
              inputs: d.savingsRate.inputs,
              result: rate === null ? "Belum ada pemasukan periode ini" : formatPercent(rate),
            },
            { label: "Perubahan pemasukan", formula: d.incomeChange.formula, inputs: d.incomeChange.inputs },
            { label: "Perubahan pengeluaran", formula: d.expenseChange.formula, inputs: d.expenseChange.inputs },
            { label: "Grafik saldo", formula: d.dailyBalance.formula, inputs: d.dailyBalance.inputs },
          ]}
        />
      }
    >
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        <div className="flex flex-col gap-1">
          <dt className="text-small text-secondary">Pemasukan</dt>
          <dd className="flex flex-col gap-1">
            <Amount value={d.income.value} size="large" className="text-primary" />
            <ChangeLine percent={d.incomeChange.value} comparedTo={prev} />
            {ownerFlows ? <OwnerSplit people={people} values={ownerFlows.map((o) => ({ ownerId: o.ownerId, amount: o.income }))} /> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-small text-secondary">Pengeluaran</dt>
          <dd className="flex flex-col gap-1">
            <Amount value={d.expense.value} size="large" className="text-primary" />
            <ChangeLine percent={d.expenseChange.value} comparedTo={prev} />
            {ownerFlows ? <OwnerSplit people={people} values={ownerFlows.map((o) => ({ ownerId: o.ownerId, amount: o.expense }))} /> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-small text-secondary">Rasio tabungan</dt>
          <dd className="flex flex-col gap-1">
            {rate === null ? (
              <span className="text-body text-secondary sm:min-h-[34px] sm:content-center">Belum ada pemasukan periode ini</span>
            ) : (
              <>
                <span className="tabular text-large text-primary">{formatPercent(rate)}</span>
                {previousRate === null ? (
                  <span className="text-small text-secondary">Belum ada pemasukan {prev}</span>
                ) : (
                  <PointsLine points={rate - previousRate} comparedTo={prev} />
                )}
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-small font-medium text-primary">{title}</h3>
        <p className="text-caption text-secondary">Garis putus-putus: proyeksi dari rata-rata pengeluaran harian dan tagihan terjadwal sampai {periodEnd}.</p>
        <CumulativeBalanceChart points={d.dailyBalance.value} summary={title} />
        <ChartDataTable
          caption={`Saldo likuid harian ${d.ranges.period.label}`}
          columns={[{ label: "Tanggal" }, { label: "Saldo likuid", numeric: true }, { label: "Keterangan" }]}
          rows={d.dailyBalance.value.map((p) => ({
            key: p.day,
            cells: [dayText(p.day), formatRupiah(p.balance), p.projected ? "Proyeksi" : "Aktual"],
          }))}
        />
      </div>
    </SectionCard>
  );
}
