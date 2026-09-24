import { formatPercent } from "@/lib/money";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { HealthCheck, HealthState } from "@/server/metrics/health-checks";
import { FormulaExplainer } from "./formula-explainer";
import { SectionCard } from "./section-card";

const oneDecimal = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

const STATE: Record<HealthState, { text: string; tone: BadgeTone }> = {
  good: { text: "Aman", tone: "positive" },
  watch: { text: "Pantau", tone: "neutral" },
  attention: { text: "Perlu dicek", tone: "attention" },
};

export function healthValueText(c: HealthCheck): string {
  const v = c.value;
  switch (c.key) {
    case "emergency_fund":
      return v === null ? "Belum ada data pengeluaran" : `${oneDecimal.format(v)} bulan pengeluaran`;
    case "savings_rate":
      return v === null ? "Belum ada pemasukan periode ini" : formatPercent(v);
    case "debt_ratio":
      return v === null ? "Belum ada pemasukan periode ini" : `${formatPercent(v)} dari pemasukan`;
    case "overdue_bills":
      return v === 0 ? "Tidak ada" : `${v} tagihan`;
  }
}

/** Empat pemeriksaan dengan rumusnya; tidak ada skor tunggal (F-DASH-1 AC4). */
export function HealthSection({ checks, periodLabel, className }: { checks: HealthCheck[]; periodLabel?: string; className?: string }) {
  return (
    <SectionCard
      id="cek-kesehatan"
      className={className}
      title={
        <>
          Cek kesehatan
          {periodLabel ? <span className="ml-2 text-small font-normal text-secondary">{periodLabel}</span> : null}
        </>
      }
      action={
        <FormulaExplainer
          trigger="icon"
          title="Cek kesehatan"
          items={checks.map((c) => ({ label: c.label, formula: c.formula, inputs: c.inputs, result: healthValueText(c) }))}
        />
      }
    >
      <ul className="flex flex-col">
        {checks.map((c) => (
          <li key={c.key} className="flex flex-col gap-0.5 border-b border-border py-2.5 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-small text-secondary">{c.label}</span>
              <Badge tone={STATE[c.state].tone}>{STATE[c.state].text}</Badge>
            </div>
            <span className="tabular text-body text-primary">{healthValueText(c)}</span>
            <span className="text-caption text-secondary">{c.formula}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
