import { describe, expect, it } from "vitest";
import { monthEndForecast, quartileTimes4, weeklySums } from "@/server/metrics/forecast";

const days = (n: number, amount: bigint) => Array.from({ length: n }, () => amount);

describe("monthEndForecast (F-BUD-2)", () => {
  it("rentang dari kuartil rata-rata mingguan", () => {
    /**
     * 30 hari data. Dua hari tertua (999.000) dibuang karena tidak genap seminggu.
     * Minggu dari terlama: 7 × 400.000 = 2.800.000, 7 × 300.000 = 2.100.000, 7 × 200.000 = 1.400.000, 7 × 100.000 = 700.000
     * Urut: 700.000, 1.400.000, 2.100.000, 2.800.000 (n = 4)
     * P25: posisi 0,75 -> 700.000 + 0,75 × 700.000 = 1.225.000 per minggu = 175.000 per hari
     * P75: posisi 2,25 -> 2.100.000 + 0,25 × 700.000 = 2.275.000 per minggu = 325.000 per hari
     * Sisa hari 25-30 Sep = 6; terpakai 3.000.000; tagihan 300.000 + 200.000 = 500.000
     * Rendah = 3.000.000 + 500.000 + 6 × 175.000 = 4.550.000
     * Tinggi = 3.000.000 + 500.000 + 6 × 325.000 = 5.450.000
     */
    const daily = [...days(2, 999_000n), ...days(7, 400_000n), ...days(7, 300_000n), ...days(7, 200_000n), ...days(7, 100_000n)];
    const m = monthEndForecast({
      today: "2026-09-24",
      periodLast: "2026-09-30",
      spentSoFar: 3_000_000n,
      dataDays: 30,
      dailyFlexible: daily,
      billsRemaining: [
        { billId: "a", name: "Listrik", dueOn: "2026-09-26", amount: 300_000n },
        { billId: "b", name: "BPJS", dueOn: "2026-09-28", amount: 200_000n },
      ],
    });
    expect(m.value).toEqual({
      available: true,
      low: 4_550_000n,
      high: 5_450_000n,
      spentSoFar: 3_000_000n,
      billsRemaining: 500_000n,
      remainingDays: 6,
      dailyLow: 175_000n,
      dailyHigh: 325_000n,
      weeks: 4,
      windowDays: 30,
      dataDays: 30,
    });
    expect(m.inputs["Sisa hari"]).toBe(6);
    expect(m.inputs["Tagihan Listrik (2026-09-26)"]).toBe(300_000n);
    expect(m.formula).toContain("persentil 25");
  });

  it("belum ada 30 hari data: tidak ada rentang, hanya jumlah hari", () => {
    const m = monthEndForecast({
      today: "2026-09-24",
      periodLast: "2026-09-30",
      spentSoFar: 1_000_000n,
      dataDays: 12,
      dailyFlexible: days(12, 50_000n),
      billsRemaining: [],
    });
    expect(m.value).toEqual({ available: false, dataDays: 12, requiredDays: 30 });
  });

  it("pembulatan per hari ke rupiah terdekat", () => {
    // lima minggu masing-masing 100 -> kuartil 100 per minggu -> 100 / 7 = 14,29 -> 14 per hari; 6 hari = 84
    const m = monthEndForecast({
      today: "2026-09-24",
      periodLast: "2026-09-30",
      spentSoFar: 0n,
      dataDays: 90,
      dailyFlexible: [100n, ...days(6, 0n), 100n, ...days(6, 0n), 100n, ...days(6, 0n), 100n, ...days(6, 0n), 100n, ...days(6, 0n)],
      billsRemaining: [],
    });
    expect(m.value).toMatchObject({ available: true, dailyLow: 14n, dailyHigh: 14n, low: 84n, high: 84n, weeks: 5 });
  });

  it("hari terakhir bulan: rentang = terpakai + tagihan", () => {
    const m = monthEndForecast({
      today: "2026-09-30",
      periodLast: "2026-09-30",
      spentSoFar: 2_000_000n,
      dataDays: 60,
      dailyFlexible: days(60, 70_000n),
      billsRemaining: [{ billId: "a", name: "Sewa", dueOn: "2026-09-30", amount: 1_000_000n }],
    });
    expect(m.value).toMatchObject({ available: true, low: 3_000_000n, high: 3_000_000n, remainingDays: 0 });
  });
});

describe("kuartil dan minggu", () => {
  it("quartileTimes4 memakai interpolasi linear", () => {
    // [10, 20, 30, 40, 50]: P25 posisi 1 -> 20; P75 posisi 3 -> 40
    expect(quartileTimes4([10n, 20n, 30n, 40n, 50n], 1)).toBe(80n);
    expect(quartileTimes4([10n, 20n, 30n, 40n, 50n], 3)).toBe(160n);
    // [0, 100]: P25 posisi 0,25 -> 25; P75 posisi 0,75 -> 75
    expect(quartileTimes4([0n, 100n], 1)).toBe(100n);
    expect(quartileTimes4([0n, 100n], 3)).toBe(300n);
  });

  it("weeklySums menghitung mundur dari hari terbaru", () => {
    expect(weeklySums([...days(3, 9n), ...days(7, 1n), ...days(7, 2n)])).toEqual([14n, 7n]);
  });
});
