"use client";

import { useEffect, useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { XAxisTickContentProps } from "recharts";
import { formatCompact, formatRupiah, toSafeNumber } from "@/lib/money";
import { ChartTooltipCard, ChartTooltipRow } from "./chart-tooltip";

export interface TrendPoint {
  month: string;
  /** Label sumbu, misalnya "Sep". */
  axisLabel: string;
  /** Label lengkap untuk tooltip, misalnya "September 2026". */
  label: string;
  income: bigint;
  expense: bigint;
}

type Row = { month: string; axisLabel: string; label: string; income: number; expense: number };

function axisMoney(v: number): string {
  return formatCompact(BigInt(Math.round(v)));
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 599px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** Contoh warna seri di legenda dan tooltip: pemasukan isi penuh, pengeluaran garis putus-putus. */
export function SeriesSwatch({ series }: { series: "income" | "expense" }) {
  return series === "income" ? (
    <span aria-hidden className="inline-block size-3 shrink-0 rounded-xs bg-primary" />
  ) : (
    <span aria-hidden className="inline-block size-3 shrink-0 rounded-xs border border-dashed border-secondary bg-surface-sunken" />
  );
}

/** Tren 12 bulan: pemasukan text-primary, pengeluaran text-secondary berarsir dan bergaris putus-putus (DESIGN 8). */
export function TrendChart({ points, summary, selected }: { points: TrendPoint[]; summary: string; selected: string }) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`;
  const narrow = useNarrow();
  const selectedIndex = points.findIndex((p) => p.month === selected);
  const rows: Row[] = points.map((p) => ({
    month: p.month,
    axisLabel: p.axisLabel,
    label: p.label,
    income: toSafeNumber(p.income),
    expense: toSafeNumber(p.expense),
  }));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-small text-secondary" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <SeriesSwatch series="income" />
          Pemasukan
        </span>
        <span className="inline-flex items-center gap-2">
          <SeriesSwatch series="expense" />
          Pengeluaran
        </span>
      </div>
      <div role="img" aria-label={summary} className="h-60 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
            <defs>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--surface-sunken)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--text-secondary)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="axisLabel"
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload }: XAxisTickContentProps) =>
                // layar sempit: label tiap 3 bulan dihitung mundur dari bulan terpilih supaya tidak bertumpuk
                narrow && (selectedIndex - payload.index) % 3 !== 0 ? (
                  <g />
                ) : (
                <text
                  x={x}
                  y={Number(y) + 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill={rows[payload.index]?.month === selected ? "var(--text-primary)" : "var(--text-secondary)"}
                  fontWeight={rows[payload.index]?.month === selected ? 600 : 400}
                >
                  {payload.value}
                </text>
                )
              }
              interval={0}
              minTickGap={0}
            />
            <YAxis
              tickFormatter={axisMoney}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              tickCount={4}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-sunken)" }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                return (
                  <ChartTooltipCard title={row.label}>
                    <ChartTooltipRow label="Pemasukan" value={formatRupiah(BigInt(row.income))} swatch={<SeriesSwatch series="income" />} />
                    <ChartTooltipRow label="Pengeluaran" value={formatRupiah(BigInt(row.expense))} swatch={<SeriesSwatch series="expense" />} />
                  </ChartTooltipCard>
                );
              }}
            />
            <Bar dataKey="income" fill="var(--text-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={20} />
            <Bar
              dataKey="expense"
              fill={`url(#${hatchId})`}
              stroke="var(--text-secondary)"
              strokeDasharray="3 2"
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
