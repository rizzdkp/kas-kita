import { addDaysKey, diffDaysKey } from "./_time";
import type { Metric } from "./types";

export interface DailyPoint {
  day: string;
  balance: bigint;
  projected: boolean;
}

export interface CumulativeDailyInput {
  /** Saldo likuid di akhir hari sebelum `from`. */
  startBalance: bigint;
  from: string;
  /** Hari ini (inklusif), titik aktual terakhir. */
  today: string;
  /** Hari terakhir periode (inklusif), ujung garis proyeksi. */
  periodLast: string;
  deltas: Array<{ day: string; amount: bigint }>;
  /** Tagihan terjadwal setelah hari ini sampai akhir periode. */
  scheduled: Array<{ day: string; amount: bigint }>;
}

/**
 * Grafik F-DASH-1 AC2: saldo kumulatif per hari, bukan batang harian.
 * Proyeksi = saldo hari ini - rata-rata arus keluar harian periode ini per hari - tagihan pada tanggalnya.
 */
export function cumulativeDailyBalance(input: CumulativeDailyInput): Metric<DailyPoint[]> {
  const byDay = new Map<string, bigint>();
  for (const d of input.deltas) byDay.set(d.day, (byDay.get(d.day) ?? 0n) + d.amount);

  const points: DailyPoint[] = [];
  let balance = input.startBalance;
  let outflow = 0n;
  const last = input.today < input.periodLast ? input.today : input.periodLast;
  for (let k = input.from; k <= last; k = addDaysKey(k, 1)) {
    const delta = byDay.get(k) ?? 0n;
    if (delta < 0n) outflow += -delta;
    balance += delta;
    points.push({ day: k, balance, projected: false });
  }

  const elapsed = Math.max(1, diffDaysKey(input.from, last) + 1);
  const avgOutflow = outflow / BigInt(elapsed);
  const scheduled = new Map<string, bigint>();
  for (const s of input.scheduled) scheduled.set(s.day, (scheduled.get(s.day) ?? 0n) + s.amount);
  let projected = balance;
  for (let k = addDaysKey(last, 1); k <= input.periodLast; k = addDaysKey(k, 1)) {
    projected -= avgOutflow + (scheduled.get(k) ?? 0n);
    points.push({ day: k, balance: projected, projected: true });
  }

  return {
    value: points,
    formula:
      "Saldo harian = saldo likuid awal periode + perubahan saldo sampai hari itu. Garis putus-putus = saldo hari ini - rata-rata arus keluar harian - tagihan terjadwal",
    inputs: {
      "Saldo awal": input.startBalance,
      "Saldo hari ini": balance,
      "Rata-rata arus keluar harian": avgOutflow,
      "Hari berjalan": elapsed,
    },
  };
}
