import { CircleAlert, CircleCheck, Gauge, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BudgetState } from "@/server/metrics/budget-status";

const STATUS: Record<BudgetState, { label: string; tone: "positive" | "neutral" | "attention"; icon: typeof CircleCheck }> = {
  on_track: { label: "Sesuai", tone: "positive", icon: CircleCheck },
  near: { label: "Mendekati", tone: "neutral", icon: Gauge },
  over: { label: "Lewat", tone: "attention", icon: CircleAlert },
};

/** Status anggaran selalu teks + ikon; warna perhatian hanya untuk "Lewat" (F-BUD-1 AC2). */
export function BudgetStatusBadge({ state }: { state: BudgetState }) {
  const s = STATUS[state];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

export function PaceBadge() {
  return (
    <Badge tone="neutral" icon={TrendingUp}>
      Lebih cepat dari biasa
    </Badge>
  );
}
