import { addDaysKey } from "@/server/metrics/_time";

export const WEEK_LENGTH_DAYS = 7;
// pembanding kategori: rata-rata mingguan 4 minggu sebelum minggu yang dirangkum (F-AI-2 AC1)
export const COMPARISON_WEEKS = 4;

/** Senin dari minggu yang memuat `key` (minggu Senin-Minggu, kalender murni). */
export function mondayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysKey(key, -((weekday + 6) % 7));
}

/** Senin minggu lalu: minggu yang dirangkum job Senin 06.00 dan yang dibaca dashboard sepanjang minggu ini. */
export function summarizedWeekStart(today: string): string {
  return addDaysKey(mondayOf(today), -WEEK_LENGTH_DAYS);
}

export function weekEnd(weekStart: string): string {
  return addDaysKey(weekStart, WEEK_LENGTH_DAYS - 1);
}
