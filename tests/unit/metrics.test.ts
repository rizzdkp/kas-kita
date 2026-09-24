import { describe, expect, it } from "vitest";
import { nextOccurrence, occurrencesBefore } from "@/server/metrics/_rrule";
import { budgetStatus } from "@/server/metrics/budget-status";
import { categoryBreakdown } from "@/server/metrics/category-breakdown";
import { cumulativeDailyBalance } from "@/server/metrics/cumulative-daily-balance";
import { daysToPayday } from "@/server/metrics/days-to-payday";
import { healthChecks } from "@/server/metrics/health-checks";
import { liabilities } from "@/server/metrics/liabilities";
import { liquidBalance } from "@/server/metrics/liquid-balance";
import { illiquidAssets, netWorth } from "@/server/metrics/net-worth";
import { comparableRanges, periodComparison } from "@/server/metrics/period-comparison";
import { periodExpense } from "@/server/metrics/period-expense";
import { periodIncome } from "@/server/metrics/period-income";
import { safeToSpend } from "@/server/metrics/safe-to-spend";
import { savingsRate } from "@/server/metrics/savings-rate";
import type { AccountBalanceInput } from "@/server/metrics/types";

const acc = (name: string, type: AccountBalanceInput["type"], balance: bigint, value = balance): AccountBalanceInput => ({
  id: name,
  name,
  type,
  ownerId: null,
  balance,
  value,
});

// BCA 5.000.000 + GoPay 250.000 + Tunai 100.000 = likuid 5.350.000
// Kartu -1.200.000 + PayLater -300.000 = kewajiban 1.500.000
// Reksa dana saldo 10.000.000, nilai pasar 10.500.000 + Emas 2.000.000 = aset tidak likuid 12.500.000
// Nilai bersih = 5.350.000 + 12.500.000 - 1.500.000 = 16.350.000
const accounts = [
  acc("BCA", "bank", 5_000_000n),
  acc("GoPay", "ewallet", 250_000n),
  acc("Tunai", "cash", 100_000n),
  acc("Kartu", "credit_card", -1_200_000n),
  acc("PayLater", "paylater", -300_000n),
  acc("Reksa dana", "investment", 10_000_000n, 10_500_000n),
  acc("Emas", "other_asset", 2_000_000n),
];

describe("saldo, kewajiban, nilai bersih", () => {
  it("saldo likuid", () => {
    const m = liquidBalance(accounts);
    expect(m.value).toBe(5_350_000n);
    expect(m.inputs).toEqual({ BCA: 5_000_000n, GoPay: 250_000n, Tunai: 100_000n });
    expect(m.formula).toContain("Saldo likuid");
  });

  it("kewajiban memakai nilai absolut", () => {
    expect(liabilities(accounts).value).toBe(1_500_000n);
  });

  it("nilai bersih memakai nilai pasar investasi", () => {
    expect(illiquidAssets(accounts).value).toBe(12_500_000n);
    const m = netWorth(accounts);
    expect(m.value).toBe(16_350_000n);
    expect(m.inputs).toEqual({ "Saldo likuid": 5_350_000n, "Aset tidak likuid": 12_500_000n, Kewajiban: 1_500_000n });
  });

  it("nama akun kembar tetap jadi input terpisah", () => {
    expect(Object.keys(liquidBalance([acc("BCA", "bank", 1n), acc("BCA", "bank", 2n)]).inputs)).toEqual(["BCA", "BCA (2)"]);
  });
});

describe("arus periode", () => {
  it("pemasukan dan pengeluaran membawa label periode", () => {
    expect(periodIncome({ total: 8_000_000n, count: 1, periodLabel: "1-24 Sep" }).formula).toContain("1-24 Sep");
    expect(periodExpense({ total: 6_000_000n, count: 42, periodLabel: "1-24 Sep" }).inputs["Jumlah transaksi"]).toBe(42);
  });

  it("rasio tabungan: (8.000.000 - 6.000.000) / 8.000.000 = 25%", () => {
    expect(savingsRate(8_000_000n, 6_000_000n).value).toBe(25);
  });

  it("rasio tabungan negatif: (5.000.000 - 6.000.000) / 5.000.000 = -20%", () => {
    expect(savingsRate(5_000_000n, 6_000_000n).value).toBe(-20);
  });

  it("rasio tabungan null kalau belum ada pemasukan", () => {
    expect(savingsRate(0n, 250_000n).value).toBeNull();
  });
});

describe("aman dibelanjakan", () => {
  it("5.350.000 - (500.000 + 350.000) - 1.500.000 - 800.000 = 2.200.000", () => {
    const m = safeToSpend({
      liquid: 5_350_000n,
      nextPayday: "2026-09-25",
      billsDue: [
        { billId: "a", name: "Listrik", dueOn: "2026-09-20", amount: 500_000n },
        { billId: "b", name: "Internet", dueOn: "2026-09-24", amount: 350_000n },
      ],
      goalSetAsides: [{ goalId: "g", name: "Liburan", amount: 1_500_000n }],
      mandatoryBudgets: [
        { budgetId: "x", name: "Belanja dapur", remaining: 800_000n },
        // anggaran yang sudah lewat tidak menambah sisa
        { budgetId: "y", name: "Transportasi", remaining: -100_000n },
      ],
    });
    expect(m.value).toBe(2_200_000n);
    expect(m.components).toEqual({ liquid: 5_350_000n, billsDue: 850_000n, goalSetAsides: 1_500_000n, mandatoryRemaining: 800_000n });
    expect(m.inputs["Tagihan Listrik (2026-09-20)"]).toBe(500_000n);
  });

  it("boleh negatif untuk copy \"Kurang Rp [x] sampai gajian\"", () => {
    const m = safeToSpend({ liquid: 100_000n, nextPayday: "2026-09-25", billsDue: [{ billId: "a", name: "Sewa", dueOn: "2026-09-24", amount: 400_000n }], goalSetAsides: [], mandatoryBudgets: [] });
    expect(m.value).toBe(-300_000n);
  });
});

describe("hari menuju gajian", () => {
  const rizz = { userId: "rizz", name: "Rizz", paydayDay: 25 };
  const nadia = { userId: "nadia", name: "Nadia", paydayDay: 1 };
  const now = new Date("2026-09-24T10:00:00+07:00");

  it("Saya: 24 Sep ke 25 Sep = 1 hari", () => {
    expect(daysToPayday([rizz], now)).toMatchObject({ value: 1, nextPayday: "2026-09-25" });
  });

  it("Partner: 24 Sep ke 1 Okt = 7 hari", () => {
    expect(daysToPayday([nadia], now)).toMatchObject({ value: 7, nextPayday: "2026-10-01" });
  });

  it("Gabungan memakai gajian terdekat dari kedua orang", () => {
    expect(daysToPayday([rizz, nadia], now)).toMatchObject({ value: 1, userIds: ["rizz"] });
  });

  it("tanggal 31 di Februari jatuh ke 28 Feb: 10 Feb ke 28 Feb = 18 hari", () => {
    expect(daysToPayday([{ userId: "a", name: "A", paydayDay: 31 }], new Date("2026-02-10T08:00:00+07:00")).value).toBe(18);
  });

  it("pukul 23.30 WIB masih dihitung hari yang sama", () => {
    // 24 Sep 23.30 WIB = 24 Sep 16.30 UTC; tetap 1 hari ke 25 Sep
    expect(daysToPayday([rizz], new Date("2026-09-24T16:30:00Z")).value).toBe(1);
  });
});

describe("saldo kumulatif harian", () => {
  it("titik aktual dan proyeksi dihitung manual", () => {
    // 1 Sep: 1.000.000 + 500.000 = 1.500.000; 2 Sep: -300.000 = 1.200.000; 3 Sep: -60.000 = 1.140.000
    // arus keluar 360.000 / 3 hari = 120.000 per hari
    // 4 Sep proyeksi: 1.140.000 - 120.000 = 1.020.000; 5 Sep: 1.020.000 - 120.000 - tagihan 200.000 = 700.000
    const m = cumulativeDailyBalance({
      startBalance: 1_000_000n,
      from: "2026-09-01",
      today: "2026-09-03",
      periodLast: "2026-09-05",
      deltas: [
        { day: "2026-09-01", amount: 500_000n },
        { day: "2026-09-02", amount: -300_000n },
        { day: "2026-09-03", amount: -60_000n },
      ],
      scheduled: [{ day: "2026-09-05", amount: 200_000n }],
    });
    expect(m.value).toEqual([
      { day: "2026-09-01", balance: 1_500_000n, projected: false },
      { day: "2026-09-02", balance: 1_200_000n, projected: false },
      { day: "2026-09-03", balance: 1_140_000n, projected: false },
      { day: "2026-09-04", balance: 1_020_000n, projected: true },
      { day: "2026-09-05", balance: 700_000n, projected: true },
    ]);
    expect(m.inputs["Rata-rata arus keluar harian"]).toBe(120_000n);
  });

  it("hari tanpa transaksi tetap punya titik", () => {
    const m = cumulativeDailyBalance({ startBalance: 10n, from: "2026-09-01", today: "2026-09-03", periodLast: "2026-09-03", deltas: [], scheduled: [] });
    expect(m.value.map((p) => p.balance)).toEqual([10n, 10n, 10n]);
  });
});

describe("pengeluaran per kategori", () => {
  it("dikelompokkan ke induk dengan kontribusi per pemilik", () => {
    // Makan dan minum = Belanja dapur (Rizz 600.000 + Bersama 400.000) + Kopi (Rizz 250.000) = 1.250.000
    // Rizz 850.000, Bersama 400.000; Transportasi Nadia 300.000
    const food = { parentId: "food", parentName: "Makan dan minum", parentIcon: "utensils" };
    const m = categoryBreakdown([
      { categoryId: "groceries", name: "Belanja dapur", icon: "shopping-basket", ...food, ownerId: "rizz", amount: 600_000n },
      { categoryId: "coffee", name: "Kopi dan jajan", icon: "coffee", ...food, ownerId: "rizz", amount: 250_000n },
      { categoryId: "groceries", name: "Belanja dapur", icon: "shopping-basket", ...food, ownerId: null, amount: 400_000n },
      { categoryId: "transport", name: "Transportasi", icon: "car", parentId: null, parentName: null, parentIcon: null, ownerId: "nadia", amount: 300_000n },
    ]);
    expect(m.value.map((c) => [c.name, c.total])).toEqual([
      ["Makan dan minum", 1_250_000n],
      ["Transportasi", 300_000n],
    ]);
    expect(m.value[0]!.byOwner).toEqual([
      { ownerId: "rizz", amount: 850_000n },
      { ownerId: null, amount: 400_000n },
    ]);
    expect(m.value[0]!.children).toEqual([
      { categoryId: "groceries", name: "Belanja dapur", total: 1_000_000n },
      { categoryId: "coffee", name: "Kopi dan jajan", total: 250_000n },
    ]);
    expect(m.inputs.Total).toBe(1_550_000n);
  });
});

describe("status anggaran", () => {
  const base = { amount: 1_000_000n, month: "2026-09-01", today: "2026-09-12" };
  // 12 dari 30 hari = 40% hari berlalu

  it("850.000 / 1.000.000 = 85%: mendekati, 85 - 40 = 45 poin -> lebih cepat dari biasa", () => {
    const m = budgetStatus({ ...base, spent: 850_000n });
    expect(m.value).toMatchObject({ state: "near", usedPercent: 85, elapsedPercent: 40, fasterThanUsual: true, remaining: 150_000n });
  });

  it("1.100.000: lewat, sisa -100.000", () => {
    expect(budgetStatus({ ...base, spent: 1_100_000n }).value).toMatchObject({ state: "over", remaining: -100_000n });
  });

  it("400.000 = 40% sama dengan hari berlalu: sesuai", () => {
    expect(budgetStatus({ ...base, spent: 400_000n }).value).toMatchObject({ state: "on_track", fasterThanUsual: false });
  });

  it("550.000 = 55%: selisih 15 poin tepat belum diberi label; 560.000 = 16 poin diberi label", () => {
    expect(budgetStatus({ ...base, spent: 550_000n }).value.fasterThanUsual).toBe(false);
    expect(budgetStatus({ ...base, spent: 560_000n }).value.fasterThanUsual).toBe(true);
  });

  it("tepat 800.000 = 80% sudah mendekati", () => {
    expect(budgetStatus({ ...base, spent: 800_000n }).value.state).toBe("near");
  });
});

describe("cek kesehatan", () => {
  it("empat pemeriksaan dengan angka dihitung manual", () => {
    // dana darurat 9.000.000 / 3.000.000 = 3 bulan; tabungan (10jt - 7jt) / 10jt = 30%
    // cicilan 2.500.000 / 10.000.000 = 25%; 1 tagihan telat
    const checks = healthChecks({
      liquid: 9_000_000n,
      avgMonthlyExpense: 3_000_000n,
      monthsSampled: 3,
      income: 10_000_000n,
      expense: 7_000_000n,
      debtPayments: 2_500_000n,
      overdueBills: 1,
    });
    expect(checks.map((c) => [c.key, c.value, c.state])).toEqual([
      ["emergency_fund", 3, "good"],
      ["savings_rate", 30, "good"],
      ["debt_ratio", 25, "good"],
      ["overdue_bills", 1, "attention"],
    ]);
    for (const c of checks) expect(c.formula.length).toBeGreaterThan(10);
  });

  it("dana darurat 2.000.000 / 3.000.000 = 0,6 bulan; cicilan 4jt / 10jt = 40%", () => {
    const checks = healthChecks({ liquid: 2_000_000n, avgMonthlyExpense: 3_000_000n, monthsSampled: 2, income: 10_000_000n, expense: 12_000_000n, debtPayments: 4_000_000n, overdueBills: 0 });
    expect(checks.map((c) => [c.value, c.state])).toEqual([
      [0.6, "attention"],
      [-20, "attention"],
      [40, "attention"],
      [0, "good"],
    ]);
  });
});

describe("perbandingan periode setara", () => {
  it("10 Sep dibandingkan dengan 1-10 Agu", () => {
    const r = comparableRanges("calendar", 25, new Date("2026-09-10T12:00:00+07:00"));
    expect([r.current.from, r.current.to, r.previous.from, r.previous.to]).toEqual(["2026-09-01", "2026-09-10", "2026-08-01", "2026-08-10"]);
    expect(r.previous.label).toBe("1-10 Agu");
    expect([r.period.from, r.period.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("siklus gajian tanggal 25: 24 Sep ada di 25 Agu-24 Sep", () => {
    const r = comparableRanges("payday_cycle", 25, new Date("2026-09-24T12:00:00+07:00"));
    expect([r.period.from, r.period.to, r.previous.from]).toEqual(["2026-08-25", "2026-09-24", "2026-07-25"]);
  });

  it("(1.100.000 - 1.000.000) / 1.000.000 = 10%; pembanding 0 -> null", () => {
    const r = comparableRanges("calendar", 25, new Date("2026-09-10T12:00:00+07:00"));
    expect(periodComparison(1_100_000n, 1_000_000n, r).value).toBe(10);
    expect(periodComparison(1_100_000n, 0n, r).value).toBeNull();
  });
});

describe("pengulangan tagihan", () => {
  it("bulanan tanggal 31 jatuh ke hari terakhir lalu kembali ke 31", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-02-28")).toBe("2026-03-31");
  });

  it("mingguan sebelum gajian", () => {
    expect(occurrencesBefore("FREQ=WEEKLY", "2026-09-03", "2026-09-25")).toEqual(["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24"]);
  });
});
