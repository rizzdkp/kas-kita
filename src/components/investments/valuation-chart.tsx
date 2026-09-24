"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateWithYear, formatShortDate, parseDateKey } from "@/lib/dates";
import { formatCompact, formatRupiah, toSafeNumber } from "@/lib/money";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import type { ValuationRow } from "@/server/queries/investments";

type Point = { t: number; value: number; day: string };

function toPoints(valuations: ValuationRow[]): Point[] {
  return valuations.flatMap((v) => {
    const d = parseDateKey(v.valuedOn);
    return d ? [{ t: d.getTime(), value: toSafeNumber(v.marketValue), day: v.valuedOn }] : [];
  });
}

const tick = { fill: "var(--text-secondary)", fontSize: 12 };

/** Nilai pasar dari riwayat pembaruan; sumbu waktu numerik supaya jarak antar pembaruan jujur (F-INV-1 AC1). */
export function ValuationChart({ valuations, summary }: { valuations: ValuationRow[]; summary: string }) {
  const points = toPoints(valuations);
  return (
    <div role="img" aria-label={summary} className="h-48 w-full sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => formatShortDate(t)}
            tickLine={false}
            axisLine={false}
            tick={tick}
            tickMargin={8}
            tickCount={5}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(BigInt(Math.round(v)))}
            tickLine={false}
            axisLine={false}
            tick={tick}
            tickCount={4}
            width={56}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!point) return null;
              return (
                <ChartTooltipCard title={formatDateWithYear(point.t)}>
                  <ChartTooltipRow label="Nilai pasar" value={formatRupiah(BigInt(point.value))} />
                </ChartTooltipCard>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
