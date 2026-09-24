import { cn } from "@/components/ui/cn";

type MeterBarProps = {
  /** 0-100+, dipotong ke 100 untuk lebar. */
  percent: number;
  /** Penanda hari ini (persen hari lewat); null = tidak ditampilkan. */
  markerPercent?: number | null;
  tone?: "neutral" | "attention" | "positive";
  className?: string;
};

const FILL = {
  neutral: "bg-secondary",
  attention: "bg-attention",
  positive: "bg-positive",
} as const;

/** Batang progres dekoratif; angka dan status selalu ditulis sebagai teks di sebelahnya. */
export function MeterBar({ percent, markerPercent = null, tone = "neutral", className }: MeterBarProps) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div aria-hidden className={cn("relative h-2 w-full rounded-pill bg-surface-sunken", className)}>
      <div className={cn("h-full rounded-pill", FILL[tone])} style={{ width: `${width}%` }} />
      {markerPercent !== null ? (
        <div
          className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-pill bg-primary"
          style={{ left: `${Math.max(0, Math.min(100, markerPercent))}%` }}
        />
      ) : null}
    </div>
  );
}

/** Permukaan daftar: sama dengan Card tapi tanpa padding, karena Card tidak menggabungkan kelas padding. */
export const listSurface = "overflow-hidden rounded-card border border-border bg-surface";
