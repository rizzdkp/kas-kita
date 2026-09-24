import { Amount } from "@/components/money/amount";
import { formatRupiah } from "@/lib/money";
import { MeterBar } from "./meter-bar";

type BudgetSummaryProps = {
  totalAmount: bigint;
  totalSpent: bigint;
  /** Hanya untuk bulan berjalan. */
  day: { elapsed: number; total: number } | null;
};

/** Total anggaran vs total terpakai; angka berdiri di kanvas tanpa kartu (DESIGN 8). */
export function BudgetSummary({ totalAmount, totalSpent, day }: BudgetSummaryProps) {
  const over = totalSpent > totalAmount;
  const percent = totalAmount > 0n ? Number((totalSpent * 1000n) / totalAmount) / 10 : 0;
  const marker = day ? (day.elapsed / day.total) * 100 : null;
  return (
    <section aria-label="Total anggaran" className="flex flex-col gap-3">
      <p className="text-small text-secondary">Terpakai dari total anggaran</p>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Amount value={totalSpent} size="large" />
        <span className="text-body text-secondary">
          dari <span className="tabular">{formatRupiah(totalAmount)}</span>
        </span>
      </p>
      <MeterBar percent={percent} markerPercent={marker} tone={over ? "attention" : "neutral"} className="max-w-xl" />
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-small text-secondary">
        {over ? (
          <span className="text-attention">
            Lewat <span className="tabular">{formatRupiah(totalSpent - totalAmount)}</span>
          </span>
        ) : (
          <span>
            Sisa <span className="tabular text-primary">{formatRupiah(totalAmount - totalSpent)}</span>
          </span>
        )}
        {day ? (
          <span>
            Hari ke-{day.elapsed} dari {day.total}
          </span>
        ) : null}
      </p>
    </section>
  );
}
