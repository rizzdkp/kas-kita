import { formatRangeLabel, jakartaDate } from "@/lib/dates";
import { addDaysKey, addMonthsKey, monthEndKey, startOfKey } from "@/server/metrics/_time";

// modul murni (tanpa db) supaya bisa dites unit dan dipakai halaman cetak

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const monthLongFormatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const monthShortFormatter = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" });

/** "YYYY-MM" dari ?bulan=; kosong, rusak, atau bulan depan jatuh ke bulan berjalan. */
export function parseMonthParam(value: unknown, today: string): string {
  const current = today.slice(0, 7);
  if (typeof value !== "string" || !MONTH.test(value)) return current;
  return value > current ? current : value;
}

export function shiftMonth(month: string, delta: number): string {
  return addMonthsKey(`${month}-01`, delta, 1).slice(0, 7);
}

function monthDate(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return jakartaDate(y, m - 1, 15);
}

/** "September 2026". */
export function formatMonthLong(month: string): string {
  return monthLongFormatter.format(monthDate(month));
}

/** "Sep" untuk sumbu tren; tahun ditambah di Januari supaya pergantian tahun terbaca. */
export function formatMonthAxis(month: string): string {
  const short = monthShortFormatter.format(monthDate(month)).replace(".", "");
  return month.endsWith("-01") ? `${short} ${month.slice(2, 4)}` : short;
}

export interface ReportRange {
  start: Date;
  end: Date;
  /** Kunci hari WIB, inklusif. */
  from: string;
  to: string;
  label: string;
}

function keyRange(from: string, to: string): ReportRange {
  const start = startOfKey(from);
  const end = startOfKey(addDaysKey(to, 1));
  return { from, to, start, end, label: formatRangeLabel({ start, end } as Parameters<typeof formatRangeLabel>[0]) };
}

export interface ReportRanges {
  month: string;
  /** Bulan penuh (bulan berjalan: sampai hari ini). */
  current: ReportRange;
  /** Pembanding dengan panjang hari yang sama (PRD bagian 6). */
  previous: ReportRange;
  isCurrentMonth: boolean;
}

/** Bulan lampau: bulan penuh vs bulan penuh sebelumnya. Bulan berjalan: 1-hari ini vs 1-tanggal sama bulan lalu. */
export function reportRanges(month: string, today: string): ReportRanges {
  const first = `${month}-01`;
  const last = monthEndKey(first);
  const isCurrentMonth = today.slice(0, 7) === month;
  const prevFirst = addMonthsKey(first, -1, 1);
  const prevLast = monthEndKey(prevFirst);
  if (!isCurrentMonth) {
    return { month, current: keyRange(first, last), previous: keyRange(prevFirst, prevLast), isCurrentMonth };
  }
  const sameDay = addMonthsKey(prevFirst, 0, Number(today.slice(8, 10)));
  return {
    month,
    current: keyRange(first, today),
    previous: keyRange(prevFirst, sameDay < prevLast ? sameDay : prevLast),
    isCurrentMonth,
  };
}

