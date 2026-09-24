import { dateKey, parseDateKey } from "@/lib/dates";

/** Aritmetika kunci hari "YYYY-MM-DD"; kalender murni, tanpa jam, jadi aman dari zona waktu proses. */
const DAY_MS = 86_400_000;

function toUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  return fromUtc(toUtc(key) + days * DAY_MS);
}

/** b - a dalam hari. */
export function diffDaysKey(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function monthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function monthEndKey(key: string): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return fromUtc(Date.UTC(y, m, 0));
}

export function addMonthsKey(key: string, months: number, day?: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1 + months, 1);
  const t = new Date(target);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day ?? d, last)));
}

/** Kunci hari WIB dari instan. */
export function keyOf(d: Date): string {
  return dateKey(d);
}

/** Awal hari WIB sebagai instan UTC. */
export function startOfKey(key: string): Date {
  const d = parseDateKey(key);
  if (!d) throw new RangeError(`Tanggal tidak valid: ${key}`);
  return new Date(d.getTime());
}

export function eachDayKey(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDaysKey(k, 1)) out.push(k);
  return out;
}
