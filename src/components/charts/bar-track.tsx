import { cn } from "@/components/ui/cn";

export interface BarSegment {
  key: string;
  /** Porsi dari nilai maksimum trek, 0-100. */
  percent: number;
  background: string;
}

type BarTrackProps = {
  /** Porsi terisi 0-100 (dipotong di 100). */
  percent: number;
  /** Segmen per pemilik; kalau ada, menggantikan isian tunggal. */
  segments?: BarSegment[];
  /** Posisi penanda hari ini, 0-100. */
  marker?: number;
  tone?: "neutral" | "attention";
  className?: string;
};

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** Batang horizontal dekoratif: nilai selalu ditulis sebagai teks di sampingnya, jadi trek aria-hidden. */
export function BarTrack({ percent, segments, marker, tone = "neutral", className }: BarTrackProps) {
  return (
    <div aria-hidden className={cn("relative h-2 w-full rounded-pill bg-surface-sunken", className)}>
      {segments?.length ? (
        <div className="absolute inset-y-0 left-0 flex gap-0.5" style={{ width: `${clamp(percent)}%` }}>
          {segments.map((s) => (
            <span
              key={s.key}
              className="h-full min-w-1 first:rounded-l-pill last:rounded-r-pill"
              style={{ flexGrow: s.percent, flexBasis: 0, background: s.background }}
            />
          ))}
        </div>
      ) : (
        <div
          className={cn("absolute inset-y-0 left-0 rounded-pill", tone === "attention" ? "bg-attention" : "bg-secondary")}
          style={{ width: `${clamp(percent)}%` }}
        />
      )}
      {marker !== undefined ? (
        <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-pill bg-primary" style={{ left: `${clamp(marker)}%` }} />
      ) : null}
    </div>
  );
}
