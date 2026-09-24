import type { ReactNode } from "react";
import { formatPercent, formatRupiah } from "@/lib/money";
import { Amount } from "@/components/money/amount";
import { Delta } from "@/components/money/delta";
import { Card } from "@/components/ui/card";
import type { Dashboard } from "@/server/queries/dashboard";
import type { OwnerFlow } from "@/server/queries/reports-dashboard";
import { FormulaExplainer, type FormulaItem } from "./formula-explainer";
import { OwnerSplit } from "./owner-split";
import type { People } from "./people";
import { PeriodToggle } from "./period-toggle";

type MetricsSectionProps = {
  d: Dashboard;
  /** Rasio tabungan periode pembanding; null kalau pembanding tanpa pemasukan. */
  previousRate: number | null;
  ownerFlows: OwnerFlow[] | null;
  people: People;
  noun: "bulan" | "periode";
  className?: string;
};

function ChangeLine({ percent, comparedTo }: { percent: number | null; comparedTo: string }) {
  if (percent === null) return <span className="text-small text-secondary">Tidak ada pembanding di {comparedTo}</span>;
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

function Tile({ label, explain, children }: { label: string; explain: FormulaItem[]; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 py-3">
      <dt className="flex min-h-8 items-center justify-between gap-2 text-small text-secondary">
        {label}
        <FormulaExplainer trigger="icon" title={label} items={explain} className="-my-2 -mr-2" />
      </dt>
      <dd className="flex min-w-0 flex-col gap-1">{children}</dd>
    </div>
  );
}

/** Empat angka periode dengan delta ke periode setara; nilai bersih selalu posisi hari ini (UX-FLOWS bagian 3.3). */
export function MetricsSection({ d, previousRate, ownerFlows, people, noun, className }: MetricsSectionProps) {
  const prev = d.ranges.previous.label;
  const rate = d.savingsRate.value;
  const lalu = d.period === "previous";
  const heading = `Arus ${noun} ${lalu ? "lalu" : "ini"}`;
  const net = d.netWorth;
  return (
    <Card as="section" aria-labelledby="arus" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="arus" className="text-card text-primary">
          {heading}
          <span className="ml-2 text-small font-normal text-secondary">{d.ranges.current.label}</span>
        </h2>
        <PeriodToggle period={d.period} noun={noun} />
      </div>
      <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-border">
        <Tile
          label="Pemasukan"
          explain={[
            { label: "Pemasukan", formula: d.income.formula, inputs: d.income.inputs, result: formatRupiah(d.income.value) },
            { label: "Perubahan pemasukan", formula: d.incomeChange.formula, inputs: d.incomeChange.inputs },
          ]}
        >
          <Amount value={d.income.value} size="large" className="text-primary" />
          <ChangeLine percent={d.incomeChange.value} comparedTo={prev} />
          {ownerFlows ? <OwnerSplit people={people} values={ownerFlows.map((o) => ({ ownerId: o.ownerId, amount: o.income }))} /> : null}
        </Tile>
        <Tile
          label="Pengeluaran"
          explain={[
            { label: "Pengeluaran", formula: d.expense.formula, inputs: d.expense.inputs, result: formatRupiah(d.expense.value) },
            { label: "Perubahan pengeluaran", formula: d.expenseChange.formula, inputs: d.expenseChange.inputs },
          ]}
        >
          <Amount value={d.expense.value} size="large" className="text-primary" />
          <ChangeLine percent={d.expenseChange.value} comparedTo={prev} />
          {ownerFlows ? <OwnerSplit people={people} values={ownerFlows.map((o) => ({ ownerId: o.ownerId, amount: o.expense }))} /> : null}
        </Tile>
        <Tile
          label="Rasio tabungan"
          explain={[
            {
              label: "Rasio tabungan",
              formula: d.savingsRate.formula,
              inputs: d.savingsRate.inputs,
              result: rate === null ? "Belum ada pemasukan periode ini" : formatPercent(rate),
            },
          ]}
        >
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
        </Tile>
        <Tile
          label="Nilai bersih"
          explain={[
            { label: "Saldo likuid", formula: d.liquid.formula, inputs: d.liquid.inputs, result: formatRupiah(d.liquid.value) },
            { label: "Kewajiban", formula: d.liabilities.formula, inputs: d.liabilities.inputs, result: formatRupiah(d.liabilities.value) },
            { label: "Nilai bersih", formula: net.formula, inputs: net.inputs, result: formatRupiah(net.value) },
          ]}
        >
          <Amount value={net.value} size="large" className="text-primary" />
          {/* tidak ada riwayat nilai bersih, jadi tanpa delta: yang ditulis hanya yang benar */}
          <span className="text-small text-secondary">Posisi hari ini</span>
        </Tile>
      </dl>
    </Card>
  );
}
