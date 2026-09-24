import { daysInMonth, jakartaDate, toJakarta } from "@/lib/dates";
import { MONTH_WORDS, WEEKDAYS } from "@/lib/quick-add-keywords";

export interface QuickAddToken {
  raw: string;
  norm: string;
  used: boolean;
}

export interface DateMatch {
  day: { year: number; month: number; date: number };
}

const YESTERDAY = new Set(["kemarin", "kmrn", "kemaren", "kmarin", "kmaren"]);

function shiftDays(now: Date, back: number): { year: number; month: number; date: number } {
  const z = toJakarta(now);
  const d = jakartaDate(z.getFullYear(), z.getMonth(), z.getDate() - back);
  return { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() };
}

function isFuture(now: Date, year: number, month: number, date: number): boolean {
  const z = toJakarta(now);
  return Date.UTC(year, month, date) > Date.UTC(z.getFullYear(), z.getMonth(), z.getDate());
}

// tanggal tanpa tahun/bulan dianggap yang terakhir lewat, karena quick-add mencatat masa lalu
function resolveCalendar(now: Date, dateNum: number, month: number | null, year: number | null) {
  const z = toJakarta(now);
  let y = year ?? z.getFullYear();
  let m = month ?? z.getMonth();
  if (year === null && isFuture(now, y, m, Math.min(dateNum, daysInMonth(y, m)))) {
    if (month === null) {
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    } else {
      y -= 1;
    }
  }
  return { year: y, month: m, date: Math.min(dateNum, daysInMonth(y, m)) };
}

function parseDayNumber(s: string | undefined): number | null {
  if (!s || !/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 31 ? n : null;
}

function parseYear(s: string | undefined): number | null {
  if (!s || !/^\d{4}$/.test(s)) return null;
  const n = Number(s);
  return n >= 2000 && n <= 2100 ? n : null;
}

function mark(tokens: QuickAddToken[], from: number, count: number): void {
  for (let i = from; i < from + count && i < tokens.length; i++) tokens[i]!.used = true;
}

/** Mencari satu penanda tanggal di token, menandai token yang dipakai, dan mengembalikan harinya. */
export function extractDate(tokens: QuickAddToken[], now: Date): DateMatch | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    const next = tokens[i + 1]?.norm;

    if ((t.norm === "hari" || t.norm === "hr") && next === "ini") {
      mark(tokens, i, 2);
      return { day: shiftDays(now, 0) };
    }
    if (YESTERDAY.has(t.norm)) {
      const lusa = next === "lusa";
      mark(tokens, i, lusa ? 2 : 1);
      return { day: shiftDays(now, lusa ? 2 : 1) };
    }
    const weekday = WEEKDAYS[t.norm];
    if (weekday !== undefined) {
      const today = toJakarta(now).getDay();
      // hari yang sama dengan hari ini berarti minggu lalu; untuk hari ini orang menulis "hari ini"
      const back = ((today - weekday + 7) % 7) || 7;
      if (tokens[i - 1]?.norm === "hari" && !tokens[i - 1]!.used) mark(tokens, i - 1, 1);
      const trailing = next === "kemarin" || next === "lalu" ? 1 : 0;
      mark(tokens, i, 1 + trailing);
      return { day: shiftDays(now, back) };
    }

    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(t.norm);
    if (slash) {
      const d = parseDayNumber(slash[1]);
      const m = Number(slash[2]) - 1;
      if (d !== null && m >= 0 && m <= 11) {
        mark(tokens, i, 1);
        return { day: resolveCalendar(now, d, m, parseYear(slash[3])) };
      }
    }

    const isTglWord = t.norm === "tgl" || t.norm === "tanggal";
    const dayTokenIdx = isTglWord ? i + 1 : i;
    const dayNum = parseDayNumber(tokens[dayTokenIdx]?.norm);
    if (dayNum !== null && !tokens[dayTokenIdx]!.used) {
      const monthWord = tokens[dayTokenIdx + 1]?.norm;
      const month = monthWord !== undefined ? MONTH_WORDS[monthWord] : undefined;
      if (month !== undefined) {
        const year = parseYear(tokens[dayTokenIdx + 2]?.norm);
        mark(tokens, i, dayTokenIdx - i + 2 + (year !== null ? 1 : 0));
        return { day: resolveCalendar(now, dayNum, month, year) };
      }
      if (isTglWord) {
        mark(tokens, i, 2);
        return { day: resolveCalendar(now, dayNum, null, null) };
      }
    }
  }
  return null;
}

/** Instan transaksi: hari yang dipilih dengan jam dan menit saat ini (WIB). */
export function occurredAtFor(match: DateMatch | null, now: Date): Date {
  const z = toJakarta(now);
  const day = match?.day ?? { year: z.getFullYear(), month: z.getMonth(), date: z.getDate() };
  const at = jakartaDate(day.year, day.month, day.date, z.getHours(), z.getMinutes());
  return new Date(at.getTime());
}
