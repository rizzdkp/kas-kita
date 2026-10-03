/**
 * Penjadwalan transaksi berulang (F-IN-7), murni tanpa database dan aman diimpor komponen klien.
 * RRULE yang disimpan: FREQ, INTERVAL, BYDAY (mingguan), BYMONTHDAY, BYMONTH (tahunan).
 * Jangkar hari dan bulan selalu tertulis di RRULE supaya 31 Jan tidak bergeser jadi 28 setelah Februari.
 */

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  /** 0 = Minggu ... 6 = Sabtu. */
  byDay: number | null;
  byMonthDay: number | null;
  /** 1-12. */
  byMonth: number | null;
}

// jadwal yang lama tertinggal tidak boleh membanjiri "Perlu dikonfirmasi"; satu bulan harian sudah cukup
export const MAX_CATCH_UP = 31;

const FREQ_BY_CODE: Record<string, RecurrenceFrequency> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" };
const CODE_BY_FREQ: Record<RecurrenceFrequency, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" };
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const DAY_MS = 86_400_000;

function parts(key: string): [number, number, number] {
  return key.split("-").map(Number) as [number, number, number];
}

function utc(key: string): number {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d);
}

function keyFromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Kunci hari dengan hari dijepit ke hari terakhir bulan itu. */
function clampedKey(year: number, month: number, day: number): string {
  return keyFromUtc(Date.UTC(year, month - 1, Math.min(day, lastDayOf(year, month))));
}

export function isDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = parts(key);
  return m >= 1 && m <= 12 && d >= 1 && d <= lastDayOf(y, m);
}

export function weekdayOf(key: string): number {
  return new Date(utc(key)).getUTCDay();
}

function intIn(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

export function parseRecurrence(rule: string): Recurrence {
  const map = new Map<string, string>();
  for (const part of rule.replace(/^RRULE:/i, "").split(";")) {
    const [k, v] = part.split("=");
    if (k && v !== undefined) map.set(k.trim().toUpperCase(), v.trim().toUpperCase());
  }
  const frequency = FREQ_BY_CODE[map.get("FREQ") ?? ""];
  if (!frequency) throw new RangeError("RRULE tidak didukung");
  const interval = map.has("INTERVAL") ? intIn(map.get("INTERVAL"), 1, 366) : 1;
  if (interval === null) throw new RangeError("INTERVAL tidak valid");
  const dayCode = map.get("BYDAY");
  const byDay = dayCode === undefined ? null : DAY_CODES.indexOf(dayCode as (typeof DAY_CODES)[number]);
  if (byDay === -1) throw new RangeError("BYDAY tidak valid");
  const byMonthDay = map.has("BYMONTHDAY") ? intIn(map.get("BYMONTHDAY"), 1, 31) : null;
  if (map.has("BYMONTHDAY") && byMonthDay === null) throw new RangeError("BYMONTHDAY tidak valid");
  const byMonth = map.has("BYMONTH") ? intIn(map.get("BYMONTH"), 1, 12) : null;
  if (map.has("BYMONTH") && byMonth === null) throw new RangeError("BYMONTH tidak valid");
  return { frequency, interval, byDay, byMonthDay, byMonth };
}

export function isValidRecurrence(rule: string): boolean {
  try {
    parseRecurrence(rule);
    return true;
  } catch {
    return false;
  }
}

/** RRULE dari pilihan pengulangan; jangkarnya diambil dari tanggal berikutnya. */
export function buildRecurrenceRule(frequency: RecurrenceFrequency, anchor: string, interval = 1): string {
  const [, m, d] = parts(anchor);
  const base = [`FREQ=${CODE_BY_FREQ[frequency]}`];
  if (interval > 1) base.push(`INTERVAL=${interval}`);
  if (frequency === "weekly") base.push(`BYDAY=${DAY_CODES[weekdayOf(anchor)]}`);
  if (frequency === "monthly") base.push(`BYMONTHDAY=${d}`);
  if (frequency === "yearly") base.push(`BYMONTH=${m}`, `BYMONTHDAY=${d}`);
  return base.join(";");
}

/** Kejadian berikutnya setelah `from`. Tanggal yang tidak ada di bulan itu jatuh ke hari terakhirnya. */
export function nextRunAfter(rule: string | Recurrence, from: string): string {
  const r = typeof rule === "string" ? parseRecurrence(rule) : rule;
  const [y, m, d] = parts(from);
  switch (r.frequency) {
    case "daily":
      return keyFromUtc(utc(from) + r.interval * DAY_MS);
    case "weekly": {
      const shift = r.byDay === null ? 7 : ((r.byDay - weekdayOf(from) + 7) % 7 || 7);
      return keyFromUtc(utc(from) + (shift + 7 * (r.interval - 1)) * DAY_MS);
    }
    case "monthly": {
      const index = y * 12 + (m - 1) + r.interval;
      return clampedKey(Math.floor(index / 12), (index % 12) + 1, r.byMonthDay ?? d);
    }
    case "yearly":
      return clampedKey(y + r.interval, r.byMonth ?? m, r.byMonthDay ?? d);
  }
}

export interface DueRuns {
  /** Tanggal yang harus dibuat sekarang, urut naik, paling banyak MAX_CATCH_UP terakhir. */
  dates: string[];
  /** next_run_on baru, selalu setelah `today`. */
  next: string;
  /** Periode lama yang dilewati karena melebihi batas. */
  skipped: number;
}

/** Semua periode dari `nextRunOn` sampai `today` (inklusif), termasuk yang tertinggal. */
export function dueRuns(rule: string, nextRunOn: string, today: string, max = MAX_CATCH_UP): DueRuns {
  const r = parseRecurrence(rule);
  const all: string[] = [];
  let k = nextRunOn;
  // pengaman putaran untuk data rusak; 20 tahun harian masih di bawah batas ini
  for (let guard = 0; k <= today && guard < 10_000; guard++) {
    all.push(k);
    k = nextRunAfter(r, k);
  }
  const dates = all.length > max ? all.slice(all.length - max) : all;
  return { dates, next: k, skipped: all.length - dates.length };
}

/** Kejadian pertama yang jatuh setelah `after` dan tidak sebelum `today`; dipakai "Jadikan berulang". */
export function firstRunAfter(rule: string, after: string, today: string): string {
  const r = parseRecurrence(rule);
  let k = nextRunAfter(r, after);
  for (let guard = 0; k < today && guard < 10_000; guard++) k = nextRunAfter(r, k);
  return k;
}

export function frequencyOf(rule: string): RecurrenceFrequency {
  try {
    return parseRecurrence(rule).frequency;
  } catch {
    return "monthly";
  }
}

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const UNIT: Record<RecurrenceFrequency, string> = { daily: "hari", weekly: "minggu", monthly: "bulan", yearly: "tahun" };
const SINGLE: Record<RecurrenceFrequency, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan", yearly: "Tahunan" };

/** "Harian" / "Mingguan, Senin" / "Bulanan, tanggal 31" / "Tahunan, 29 Feb"; interval > 1 jadi "Setiap 2 minggu, Senin". */
export function describeRecurrence(rule: string, nextRunOn: string): string {
  let r: Recurrence;
  try {
    r = parseRecurrence(rule);
  } catch {
    return "Pengulangan tidak dikenal";
  }
  const [, m, d] = parts(nextRunOn);
  const head = r.interval > 1 ? `Setiap ${r.interval} ${UNIT[r.frequency]}` : SINGLE[r.frequency];
  switch (r.frequency) {
    case "daily":
      return head;
    case "weekly":
      return `${head}, ${WEEKDAYS[r.byDay ?? weekdayOf(nextRunOn)]}`;
    case "monthly":
      return `${head}, tanggal ${r.byMonthDay ?? d}`;
    case "yearly":
      return `${head}, ${r.byMonthDay ?? d} ${MONTHS[(r.byMonth ?? m) - 1]}`;
  }
}

/** Kalimat bantu untuk tanggal yang tidak ada di setiap bulan (29-31). */
export function shortMonthNote(rule: string): string | null {
  try {
    const r = parseRecurrence(rule);
    if (r.frequency === "monthly" && (r.byMonthDay ?? 0) >= 29) return "Di bulan yang lebih pendek, transaksi dibuat di hari terakhirnya.";
    if (r.frequency === "yearly" && r.byMonth === 2 && r.byMonthDay === 29) return "Di tahun yang bukan kabisat, transaksi dibuat tanggal 28 Feb.";
    return null;
  } catch {
    return null;
  }
}
