import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/glass-surface";

/** Tooltip grafik: satu-satunya glass di area konten karena melayang sementara (DESIGN 8). */
export function ChartTooltipCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassSurface variant="regular" className="pointer-events-none flex min-w-40 flex-col gap-1 px-3 py-2">
      <p className="text-caption text-secondary">{title}</p>
      {children}
    </GlassSurface>
  );
}

export function ChartTooltipRow({ label, value, swatch }: { label: string; value: string; swatch?: ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-4 text-control text-primary">
      <span className="flex items-center gap-2">
        {swatch}
        {label}
      </span>
      <span className="tabular">{value}</span>
    </p>
  );
}
