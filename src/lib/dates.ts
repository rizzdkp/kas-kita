import { TZDate } from "@date-fns/tz";
import { addDays, startOfDay } from "date-fns";

/**
 * Semua tanggal dihitung di WIB lewat TZDate, jadi hasilnya tidak bergantung pada TZ proses.
 * Rentang (DateRange) selalu setengah terbuka: start inklusif, end eksklusif (awal hari setelah hari terakhir).
 */

export const APP_TIME_ZONE = "Asia/Jakarta";

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
] as const;

export type DateInput = Date | number;
export type PeriodMode = "calendar" | "payday_cycle";

/** start inklusif, end eksklusif. */
export interface DateRange {
  start: TZDate;
  end: TZDate;
}

export interface PeriodRange extends DateRange {
  mode: PeriodMode;
  paydayDay: number;
}

const DAY_MS = 86_400_000;

export function toJakarta(d: DateInput): TZDate {
  return new TZDate(d instanceof Date ? d.getTime() : d, APP_TIME_ZONE);
}

/** Tanggal WIB dari komponen kalender; bulan 0-11 dan boleh meluap seperti Date. */
export function jakartaDate(year: number, monthIndex: number, day: number, hours = 0, minutes = 0): TZDate {
  return new TZDate(year, monthIndex, day, hours, minutes, 0, 0, APP_TIME_ZONE);
}

export function nowJakarta(now: DateInput = Date.now()): TZDate {
  return toJakarta(now);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Kunci hari "YYYY-MM-DD" di WIB. */
export function dateKey(d: DateInput): string {
  const z = toJakarta(d);
  return `${z.getFullYear()}-${pad2(z.getMonth() + 1)}-${pad2(z.getDate())}`;
}

export function todayJakarta(now: DateInput = Date.now()): string {
  return dateKey(now);
}

/** Kebalikan dateKey: awal hari WIB, atau null kalau format salah. */
export function parseDateKey(key: string): TZDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo)) return null;
  return jakartaDate(y, mo, d);
}

export function startOfDayJakarta(d: DateInput): TZDate {
  return startOfDay(toJakarta(d));
}

/** Nomor hari kalender WIB, untuk selisih hari tanpa terpengaruh jam. */
function dayIndex(d: DateInput): number {
  const z = toJakarta(d);
  return Date.UTC(z.getFullYear(), z.getMonth(), z.getDate()) / DAY_MS;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Selisih hari kalender WIB dari `from` ke `target` (negatif kalau sudah lewat). */
export function daysUntil(target: DateInput, from: DateInput = Date.now()): number {
  return dayIndex(target) - dayIndex(from);
}

export function formatShortDate(d: DateInput): string {
  const z = toJakarta(d);
  return `${z.getDate()} ${MONTHS_SHORT[z.getMonth()]}`;
}

export function formatDateWithYear(d: DateInput): string {
  return `${formatShortDate(d)} ${toJakarta(d).getFullYear()}`;
}

export function formatTime(d: DateInput): string {
  const z = toJakarta(d);
  return `${pad2(z.getHours())}.${pad2(z.getMinutes())}`;
}

/** "Hari ini", "Kemarin", lalu "12 Sep"; tahun ditulis kalau beda dengan tahun sekarang. */
export function formatRelativeDay(d: DateInput, now: DateInput = Date.now()): string {
  const diff = dayIndex(now) - dayIndex(d);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return toJakarta(d).getFullYear() === toJakarta(now).getFullYear()
    ? formatShortDate(d)
    : formatDateWithYear(d);
}

export function formatCountdown(days: number): string {
  if (days === 0) return "hari ini";
  if (days === 1) return "besok";
  if (days > 1) return `${days} hari lagi`;
  return `telat ${-days} hari`;
}

function normalizePayday(paydayDay: number): number {
  if (!Number.isFinite(paydayDay)) return 1;
  return Math.min(31, Math.max(1, Math.trunc(paydayDay)));
}

/** Tanggal gajian di bulan tertentu; tanggal yang tidak ada jatuh ke hari terakhir bulan itu. */
export function paydayInMonth(paydayDay: number, year: number, monthIndex: number): TZDate {
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  return jakartaDate(y, m, Math.min(normalizePayday(paydayDay), daysInMonth(y, m)));
}

/** Gajian berikutnya pada atau setelah hari ini (WIB), sebagai awal hari. */
export function nextPayday(paydayDay: number, from: DateInput = Date.now()): TZDate {
  const z = toJakarta(from);
  const thisMonth = paydayInMonth(paydayDay, z.getFullYear(), z.getMonth());
  if (dayIndex(thisMonth) >= dayIndex(z)) return thisMonth;
  return paydayInMonth(paydayDay, z.getFullYear(), z.getMonth() + 1);
}

/** Periode yang memuat `ref`. Siklus gajian: tanggal gajian sampai sehari sebelum gajian berikutnya. */
export function periodRange(mode: PeriodMode, paydayDay: number, ref: DateInput = Date.now()): PeriodRange {
  const z = toJakarta(ref);
  const y = z.getFullYear();
  const m = z.getMonth();
  const payday = normalizePayday(paydayDay);
  if (mode === "calendar") {
    return { mode, paydayDay: payday, start: jakartaDate(y, m, 1), end: jakartaDate(y, m + 1, 1) };
  }
  const thisMonth = paydayInMonth(payday, y, m);
  if (dayIndex(z) >= dayIndex(thisMonth)) {
    return { mode, paydayDay: payday, start: thisMonth, end: paydayInMonth(payday, y, m + 1) };
  }
  return { mode, paydayDay: payday, start: paydayInMonth(payday, y, m - 1), end: thisMonth };
}

function minDate(a: TZDate, b: TZDate): TZDate {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * Periode berjalan sampai hari ini dan pembandingnya dengan panjang hari yang sama dari periode sebelumnya.
 * Contoh: 10 Sep (kalender) -> current 1-10 Sep, previous 1-10 Agu. Pembanding tidak melewati awal periode ini.
 */
export function comparablePreviousRange(
  range: PeriodRange,
  today: DateInput = Date.now(),
): { current: DateRange; previous: DateRange } {
  const periodDays = dayIndex(range.end) - dayIndex(range.start);
  const elapsed = Math.min(periodDays, Math.max(1, daysUntil(today, range.start) + 1));
  const prevStart = periodRange(range.mode, range.paydayDay, addDays(range.start, -1)).start;
  return {
    current: { start: range.start, end: minDate(addDays(range.start, elapsed), range.end) },
    previous: { start: prevStart, end: minDate(addDays(prevStart, elapsed), range.start) },
  };
}

/** "1-10 Agu", "25 Agu-24 Sep", "25 Des 2025-24 Jan 2026"; end dianggap eksklusif. */
export function formatRangeLabel(range: DateRange): string {
  const first = toJakarta(range.start);
  const last = toJakarta(Math.max(range.start.getTime(), addDays(toJakarta(range.end), -1).getTime()));
  if (dayIndex(first) === dayIndex(last)) return formatShortDate(first);
  if (first.getFullYear() !== last.getFullYear()) {
    return `${formatDateWithYear(first)}-${formatDateWithYear(last)}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}-${formatShortDate(last)}`;
  }
  return `${formatShortDate(first)}-${formatShortDate(last)}`;
}
