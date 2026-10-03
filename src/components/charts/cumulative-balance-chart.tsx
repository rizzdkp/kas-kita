"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate, parseDateKey } from "@/lib/dates";
import { formatCompact, formatRupiah, toSafeNumber } from "@/lib/money";
import { cn } from "@/components/ui/cn";
import { ChartTooltipCard, ChartTooltipRow } from "./chart-tooltip";

export interface BalancePoint {
  day: string;
  balance: bigint;
  projected: boolean;
}

type Row = { day: string; actual: number | null; projection: number | null };

function toRows(points: BalancePoint[]): Row[] {
  const lastActual = points.findLastIndex((p) => !p.projected);
  const hasProjection = points.some((p) => p.projected);
  return points.map((p, i) => {
    const n = toSafeNumber(p.balance);
    return {
      day: p.day,
      actual: p.projected ? null : n,
      // titik aktual terakhir juga awal garis proyeksi supaya dua garis bersambung
      projection: p.projected || (hasProjection && i === lastActual) ? n : null,
    };
  });
}

function dayLabel(day: string): string {
  const d = parseDateKey(day);
  return d ? formatShortDate(d) : day;
}

function axisMoney(v: number): string {
  return formatCompact(BigInt(Math.round(v)));
}

/** Saldo likuid kumulatif harian; proyeksi putus-putus sampai akhir periode (F-DASH-1 AC2). */
export function CumulativeBalanceChart({ points, summary, className }: { points: BalancePoint[]; summary: string; className?: string }) {
  const rows = toRows(points);
  const ticks = rows.filter((_, i) => i === 0 || i === rows.length - 1 || i % 7 === 0).map((r) => r.day);
  return (
    <div role="img" aria-label={summary} className={cn("h-56 w-full sm:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            ticks={ticks}
            tickFormatter={dayLabel}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            tickMargin={8}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={axisMoney}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            tickCount={4}
            width={64}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as Row | undefined;
              if (!row) return null;
              const projected = row.actual === null;
              const value = row.actual ?? row.projection ?? 0;
              return (
                <ChartTooltipCard title={dayLabel(String(label))}>
                  <ChartTooltipRow label={projected ? "Proyeksi saldo" : "Saldo likuid"} value={formatRupiah(BigInt(Math.round(value)))} />
                </ChartTooltipCard>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="projection"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4, fill: "var(--surface)", stroke: "var(--accent)", strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
