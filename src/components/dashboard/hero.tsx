import { formatRupiah } from "@/lib/money";
import { Amount } from "@/components/money/amount";
import { HeroNumber } from "@/components/money/hero-number";
import type { DaysToPayday } from "@/server/metrics/days-to-payday";
import type { SafeToSpend } from "@/server/metrics/safe-to-spend";
import { FormulaExplainer } from "./formula-explainer";

type HeroProps = {
  label: string;
  safe: SafeToSpend;
  payday: DaysToPayday;
};

/** Hero tanpa kartu: satu angka, satu baris komponen, satu tombol rumus (UX-FLOWS bagian 3.1). */
export function Hero({ label, safe, payday }: HeroProps) {
  const short = safe.value < 0n;
  const c = safe.components;
  const parts: Array<[string, bigint]> = [
    ["Saldo likuid", c.liquid],
    ["Tagihan sebelum gajian", c.billsDue],
    ["Setoran target", c.goalSetAsides],
  ];
  if (c.mandatoryRemaining > 0n) parts.push(["Sisa anggaran wajib", c.mandatoryRemaining]);
  return (
    <section aria-labelledby="hero-label" className="flex flex-col gap-2 px-1 pb-4 sm:pb-8">
      <h2 id="hero-label" data-testid="hero-label" className="text-body text-secondary">
        {label}
      </h2>
      {short ? (
        <div className="flex flex-wrap items-baseline gap-x-3 text-primary" data-testid="hero-value">
          <span className="text-section">Kurang</span>
          <HeroNumber value={-safe.value} tone="attention" className="contents" />
          <span className="text-section">sampai gajian</span>
        </div>
      ) : (
        <div data-testid="hero-value">
          <HeroNumber value={safe.value} className="text-primary" />
        </div>
      )}
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-small text-secondary">
        {parts.map(([name, value]) => (
          <li key={name}>
            {name} <Amount value={value} className="text-primary" />
          </li>
        ))}
      </ul>
      <div>
        <FormulaExplainer
          title="Aman dibelanjakan"
          items={[
            { label: "Aman dibelanjakan", formula: safe.formula, inputs: safe.inputs, result: formatRupiah(safe.value) },
            { label: "Hari menuju gajian", formula: payday.formula, inputs: payday.inputs, result: `${payday.value} hari` },
          ]}
        />
      </div>
    </section>
  );
}
