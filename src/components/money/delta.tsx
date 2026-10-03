import { formatPercent } from "@/lib/money";
import { cn } from "@/components/ui/cn";

type DeltaProps = {
  /** Perubahan dalam persen: 12 berarti naik 12%. */
  percent: number;
  /** Label periode pembanding, misalnya "1-10 Agu". */
  comparedTo: string;
  /** Hanya untuk pengeluaran kategori beranggaran yang naik lebih dari 15% (DESIGN 8). */
  attention?: boolean;
  className?: string;
};

/** "↑ 12% dari 1-10 Agu". Panah membawa arah, jadi warna tidak pernah satu-satunya penanda. */
export function Delta({ percent, comparedTo, attention = false, className }: DeltaProps) {
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "";
  const spoken = direction === "up" ? "naik" : direction === "down" ? "turun" : "tetap";
  return (
    <span className={cn("tabular text-small", attention ? "text-attention" : "text-secondary", className)}>
      <span className="sr-only">{`${spoken} ${formatPercent(Math.abs(percent))} dari ${comparedTo}`}</span>
      <span aria-hidden>
        {arrow ? `${arrow} ` : ""}
        {formatPercent(Math.abs(percent))} dari {comparedTo}
      </span>
    </span>
  );
}
