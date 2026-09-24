import Link from "next/link";
import { formatPercent, formatRupiah } from "@/lib/money";
import { BarTrack } from "@/components/charts/bar-track";
import { Amount } from "@/components/money/amount";
import type { BudgetWithStatus } from "@/server/queries/budgets";
import type { Scope } from "@/lib/scope";
import { FormulaExplainer } from "./formula-explainer";
import { scopedHref } from "./links";
import { SectionCard } from "./section-card";

const STATE_TEXT = { on_track: "Sesuai", near: "Mendekati", over: "Lewat" } as const;

/** Lima anggaran dengan persen terpakai tertinggi; penanda vertikal = hari ini (UX-FLOWS bagian 3.4). */
export function BudgetSection({ budgets, scope, className }: { budgets: BudgetWithStatus[]; scope: Scope; className?: string }) {
  const elapsed = budgets[0]?.status.value.elapsedPercent;
  return (
    <SectionCard
      id="anggaran"
      className={className}
      title="Anggaran"
      action={
        budgets.length ? (
          <FormulaExplainer
            trigger="icon"
            title="Anggaran"
            items={budgets.map((b) => ({
              label: b.categoryName,
              formula: b.status.formula,
              inputs: b.status.inputs,
              result: b.status.value.usedPercent === null ? "-" : `${formatPercent(b.status.value.usedPercent)} terpakai`,
            }))}
          />
        ) : null
      }
    >
      {budgets.length === 0 ? (
        <p className="text-small text-secondary">
          Belum ada anggaran bulan ini.{" "}
          <Link href={scopedHref("/anggaran", scope)} className="text-accent underline">
            Atur anggaran
          </Link>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {budgets.map((b) => {
              const s = b.status.value;
              const over = s.state === "over";
              return (
                <li key={b.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-body text-primary">
                      {b.categoryName}
                      {b.isMandatory ? <span className="ml-2 text-caption text-secondary">Wajib</span> : null}
                    </span>
                    <span className={`tabular ml-auto text-right text-small ${over ? "text-attention" : "text-secondary"}`}>
                      {STATE_TEXT[s.state]}
                      {s.fasterThanUsual ? ", lebih cepat dari biasa" : ""} · {s.usedPercent === null ? "-" : formatPercent(s.usedPercent)}
                    </span>
                  </div>
                  <BarTrack percent={s.usedPercent ?? 0} marker={s.elapsedPercent} tone={over ? "attention" : "neutral"} />
                  <p className="text-caption text-secondary">
                    <Amount value={b.spent} /> dari <Amount value={b.amount} />
                    {over ? <> · lewat {formatRupiah(b.spent - b.amount)}</> : <> · sisa {formatRupiah(s.remaining)}</>}
                  </p>
                </li>
              );
            })}
          </ul>
          {elapsed !== undefined ? (
            <p className="flex items-center gap-2 text-caption text-secondary">
              <span aria-hidden className="inline-block h-3 w-0.5 rounded-pill bg-primary" />
              Garis tegak: hari ini, {formatPercent(elapsed)} bulan sudah berjalan
            </p>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}
