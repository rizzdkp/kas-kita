import { diffDaysKey } from "./_time";
import type { BillDueItem } from "./safe-to-spend";
import { inputKey, sumBigint, type Metric } from "./types";

// F-BUD-2 AC2: prediksi baru jujur setelah ada sebulan data
export const FORECAST_MIN_DATA_DAYS = 30;
export const FORECAST_WINDOW_DAYS = 90;
const WEEK = 7;

export interface ForecastInput {
  /** Hari ini (WIB). */
  today: string;
  /** Hari terakhir periode (inklusif). */
  periodLast: string;
  /** Semua pengeluaran periode sampai hari ini. */
  spentSoFar: bigint;
  /** Hari kalender sejak transaksi pertama sampai kemarin. */
  dataDays: number;
  /** Pengeluaran fleksibel per hari, urut dari hari terlama sampai kemarin; panjang = jendela. */
  dailyFlexible: bigint[];
  /** Tagihan belum dibayar yang jatuh tempo sampai akhir periode (tanpa kartu kredit). */
  billsRemaining: BillDueItem[];
}

export type Forecast =
  | { available: false; dataDays: number; requiredDays: number }
  | {
      available: true;
      low: bigint;
      high: bigint;
      spentSoFar: bigint;
      billsRemaining: bigint;
      remainingDays: number;
      /** Rata-rata harian fleksibel dari minggu kuartil bawah dan atas. */
      dailyLow: bigint;
      dailyHigh: bigint;
      weeks: number;
      windowDays: number;
      dataDays: number;
    };

function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (2n * b);
}

/** Persentil (metode linear, "tipe 7") dikali 4 supaya kuartil tetap bigint eksak. */
export function quartileTimes4(sorted: bigint[], quarter: 1 | 3): bigint {
  const n = sorted.length;
  if (n === 0) return 0n;
  const scaled = quarter * (n - 1);
  const lo = Math.floor(scaled / 4);
  const frac = BigInt(scaled % 4);
  const a = sorted[lo]!;
  const b = sorted[Math.min(lo + 1, n - 1)]!;
  return 4n * a + frac * (b - a);
}

/** Jumlah per blok 7 hari dihitung mundur dari kemarin; sisa hari tertua yang tidak genap seminggu dibuang. */
export function weeklySums(daily: bigint[]): bigint[] {
  const weeks: bigint[] = [];
  for (let end = daily.length; end - WEEK >= 0; end -= WEEK) {
    weeks.push(sumBigint(daily.slice(end - WEEK, end)));
  }
  return weeks;
}

export function monthEndForecast(input: ForecastInput): Metric<Forecast> {
  const formula =
    "Prediksi = terpakai sampai hari ini + tagihan terjadwal sampai akhir bulan + sisa hari × rata-rata harian pengeluaran fleksibel. " +
    "Pengeluaran fleksibel adalah pengeluaran 90 hari terakhir di luar kategori beranggaran wajib dan di luar pembayaran tagihan. " +
    "Rata-rata harian dihitung per minggu; batas rendah memakai kuartil bawah (persentil 25) dan batas tinggi kuartil atas (persentil 75) dari rata-rata mingguan itu.";

  if (input.dataDays < FORECAST_MIN_DATA_DAYS) {
    return {
      value: { available: false, dataDays: Math.max(0, input.dataDays), requiredDays: FORECAST_MIN_DATA_DAYS },
      formula,
      inputs: { "Hari data": Math.max(0, input.dataDays), "Minimal hari data": FORECAST_MIN_DATA_DAYS },
    };
  }

  const weeks = weeklySums(input.dailyFlexible).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const q1x4 = quartileTimes4(weeks, 1);
  const q3x4 = quartileTimes4(weeks, 3);
  const remainingDays = Math.max(0, diffDaysKey(input.today, input.periodLast));
  const rem = BigInt(remainingDays);
  // kuartil ×4 per minggu, jadi dibagi 4 × 7 untuk mendapat per hari
  const perDayDivisor = BigInt(4 * WEEK);
  const bills = sumBigint(input.billsRemaining.map((b) => b.amount));
  const base = input.spentSoFar + bills;
  const dailyLow = divRound(q1x4, perDayDivisor);
  const dailyHigh = divRound(q3x4, perDayDivisor);
  // pakai rata-rata harian yang sudah dibulatkan supaya panel rumus bisa dicek ulang dengan angka yang tampil
  const low = base + dailyLow * rem;
  const high = base + dailyHigh * rem;

  const inputs: Record<string, bigint | number | string> = {
    "Terpakai sampai hari ini": input.spentSoFar,
    "Tagihan sampai akhir bulan": bills,
    "Sisa hari": remainingDays,
    "Rata-rata harian fleksibel (rendah)": dailyLow,
    "Rata-rata harian fleksibel (tinggi)": dailyHigh,
    "Minggu yang dihitung": weeks.length,
    "Hari data": input.dataDays,
  };
  for (const b of input.billsRemaining) inputs[inputKey(inputs, `Tagihan ${b.name} (${b.dueOn})`)] = b.amount;

  return {
    value: {
      available: true,
      low,
      high,
      spentSoFar: input.spentSoFar,
      billsRemaining: bills,
      remainingDays,
      dailyLow,
      dailyHigh,
      weeks: weeks.length,
      windowDays: input.dailyFlexible.length,
      dataDays: input.dataDays,
    },
    formula,
    inputs,
  };
}
