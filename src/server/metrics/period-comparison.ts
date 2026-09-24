import { comparablePreviousRange, dateKey, formatRangeLabel, periodRange, type PeriodMode } from "@/lib/dates";
import { percentOf } from "@/lib/money";
import type { Metric } from "./types";

export interface KeyRange {
  /** Kunci hari WIB, inklusif. */
  from: string;
  to: string;
  label: string;
  /** Instan awal (inklusif) dan akhir (eksklusif) untuk query. */
  start: Date;
  end: Date;
}

export interface ComparableRanges {
  period: KeyRange;
  current: KeyRange;
  previous: KeyRange;
}

function toKeyRange(r: { start: Date; end: Date }): KeyRange {
  const last = new Date(r.end.getTime() - 1);
  return {
    from: dateKey(r.start),
    to: dateKey(last),
    label: formatRangeLabel({ start: r.start, end: r.end } as Parameters<typeof formatRangeLabel>[0]),
    start: new Date(r.start.getTime()),
    end: new Date(r.end.getTime()),
  };
}

/** Periode berjalan dan pembanding dengan panjang hari yang sama (PRD bagian 6). */
export function comparableRanges(mode: PeriodMode, paydayDay: number, now: Date): ComparableRanges {
  const period = periodRange(mode, paydayDay, now);
  const { current, previous } = comparablePreviousRange(period, now);
  return { period: toKeyRange(period), current: toKeyRange(current), previous: toKeyRange(previous) };
}

/** Perubahan dalam persen terhadap periode setara; null kalau pembanding 0. */
export function periodComparison(current: bigint, previous: bigint, ranges: ComparableRanges): Metric<number | null> {
  return {
    value: percentOf(current - previous, previous),
    formula: `Perubahan = (${ranges.current.label} - ${ranges.previous.label}) / ${ranges.previous.label}`,
    inputs: { [ranges.current.label]: current, [ranges.previous.label]: previous },
  };
}
