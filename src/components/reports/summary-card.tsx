import { formatPercent, formatRupiah, percentOf } from "@/lib/money";
import { FormulaExplainer } from "@/components/dashboard/formula-explainer";
import { SectionCard } from "@/components/dashboard/section-card";
import { Amount } from "@/components/money/amount";
import { Delta } from "@/components/money/delta";
import type { MonthlyReport } from "@/server/queries/reports";

function Change({ current, previous, comparedTo }: { current: bigint; previous: bigint; comparedTo: string }) {
  const p = percentOf(current - previous, previous);
  if (p === null) return <span className="text-small text-secondary">Tidak ada pembanding di {comparedTo}</span>;
  return <Delta percent={p} comparedTo={comparedTo} />;
}

/** Pemasukan, pengeluaran, selisih periode dan perbandingannya dengan periode setara sebelumnya. */
export function ReportSummary({ r }: { r: MonthlyReport }) {
  const prev = r.ranges.previous.label;
  const rate = r.savingsRate.value;
  const prevNet = r.previousIncome - r.previousExpense;
  return (
    <SectionCard
      id="ringkasan-laporan"
      title={
        <>
          Ringkasan
          <span className="ml-2 text-small font-normal text-secondary">
            {r.ranges.current.label}, dibanding {prev}
          </span>
        </>
      }
      action={
        <FormulaExplainer
          trigger="icon"
          title="Ringkasan laporan"
          items={[
            { label: "Pemasukan", formula: r.income.formula, inputs: { ...r.income.inputs, [`Pemasukan ${prev}`]: r.previousIncome }, result: formatRupiah(r.income.value) },
            { label: "Pengeluaran", formula: r.expense.formula, inputs: { ...r.expense.inputs, [`Pengeluaran ${prev}`]: r.previousExpense }, result: formatRupiah(r.expense.value) },
            { label: "Selisih", formula: r.net.formula, inputs: r.net.inputs, result: formatRupiah(r.net.value) },
            {
              label: "Rasio tabungan",
              formula: r.savingsRate.formula,
              inputs: r.savingsRate.inputs,
              result: rate === null ? "Belum ada pemasukan periode ini" : formatPercent(rate),
            },
          ]}
        />
      }
    >
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        <div className="flex flex-col gap-1">
          <dt className="text-small text-secondary">Pemasukan</dt>
          <dd className="flex flex-col gap-1">
            <Amount value={r.income.value} size="large" className="text-primary" />
            <Change current={r.income.value} previous={r.previousIncome} comparedTo={prev} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-small text-secondary">Pengeluaran</dt>
          <dd className="flex flex-col gap-1">
            <Amount value={r.expense.value} size="large" className="text-primary" />
            <Change current={r.expense.value} previous={r.previousExpense} comparedTo={prev} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-small text-secondary">Selisih</dt>
          <dd className="flex flex-col gap-1">
            <Amount value={r.net.value} size="large" className="text-primary" />
            <span className="text-small text-secondary">
              {rate === null ? "Belum ada pemasukan periode ini" : `Rasio tabungan ${formatPercent(rate)}`}
            </span>
            <span className="text-small text-secondary">
              Selisih {prev} <Amount value={prevNet} />
            </span>
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}
