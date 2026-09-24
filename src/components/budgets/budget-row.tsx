import { formatPercent, formatRupiah } from "@/lib/money";
import type { BudgetWithStatus } from "@/server/queries/budgets";
import { BudgetStatusBadge, PaceBadge } from "./budget-status-badge";
import { MeterBar } from "./meter-bar";

type BudgetRowProps = {
  budget: BudgetWithStatus;
  /** Penanda hari ini hanya di bulan berjalan. */
  showToday: boolean;
};

/** Isi satu baris anggaran; pembungkus (tombol ubah) disediakan pemanggil. */
export function BudgetRowContent({ budget, showToday }: BudgetRowProps) {
  const s = budget.status.value;
  const over = s.state === "over";
  const used = s.usedPercent ?? 0;
  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-card text-primary">{budget.categoryName}</span>
          <span className="text-caption text-secondary">{budget.isMandatory ? "Wajib" : "Fleksibel"}</span>
        </span>
        <span className="tabular text-body">
          <span className={over ? "text-attention" : "text-primary"}>{formatRupiah(budget.spent)}</span>
          <span className="text-secondary"> / {formatRupiah(budget.amount)}</span>
        </span>
      </div>
      <MeterBar percent={used} markerPercent={showToday ? s.elapsedPercent : null} tone={over ? "attention" : "neutral"} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <BudgetStatusBadge state={s.state} />
          {s.fasterThanUsual ? <PaceBadge /> : null}
        </span>
        <span className="tabular text-small text-secondary">
          {over ? `Lewat ${formatRupiah(-s.remaining)}` : `Sisa ${formatRupiah(s.remaining)}`}
          {s.usedPercent !== null ? ` · ${formatPercent(s.usedPercent)} terpakai` : null}
        </span>
      </div>
    </div>
  );
}
