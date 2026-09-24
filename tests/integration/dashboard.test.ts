import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { createBill } from "@/server/mutations/bills";
import { upsertBudget } from "@/server/mutations/budgets";
import { createGoal } from "@/server/mutations/goals";
import { getDashboard } from "@/server/queries/dashboard";

/**
 * Hari ini 24 Sep 2026 10.00 WIB, gajian Rizz tanggal 25 (besok), Nadia tanggal 1.
 * BCA Rizz saldo awal 10.000.000 (31 Agu), Tunai Rizz 500.000.
 *   1 Sep gaji +8.000.000, 5 Sep belanja dapur -200.000
 * Saldo likuid Saya = 10.000.000 + 8.000.000 - 200.000 + 500.000 = 18.300.000
 * Tagihan Internet Rizz 350.000 jatuh tempo 24 Sep (sebelum gajian 25 Sep) -> dihitung
 * Tagihan Sewa Rizz 3.000.000 jatuh tempo 1 Okt (setelah gajian) -> tidak dihitung
 * Tagihan Listrik Bersama -> tidak masuk cakupan Saya
 * Target Liburan Rizz 12.000.000 tenggat 31 Mar 2027 = 6 bulan -> 2.000.000 per bulan, belum ada setoran
 * Anggaran wajib Makan dan minum 1.000.000, terpakai 200.000 -> sisa 800.000; anggaran fleksibel diabaikan
 * Aman dibelanjakan = 18.300.000 - 350.000 - 2.000.000 - 800.000 = 15.150.000
 */
let h: Household;
let c: Awaited<ReturnType<typeof seedBasicCategories>>;
let bcaId: string;
const now = new Date("2026-09-24T10:00:00+07:00");

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  c = await seedBasicCategories(testDb);
  const rizz = h.rizz.user.id;
  const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: rizz, openingBalance: 10_000_000n, openingDate: "2026-08-31" });
  bcaId = bca.id;
  await createAccountRow(testDb, { name: "Tunai", type: "cash", ownerId: rizz, openingBalance: 500_000n, openingDate: "2026-08-31" });
  const shared = await createAccountRow(testDb, { name: "Bersama", type: "bank", ownerId: null, openingBalance: 2_000_000n, openingDate: "2026-08-31" });
  await insertTx(testDb, { kind: "income", amount: 8_000_000n, accountId: bca.id, categoryId: c.salary.id, occurredAt: "2026-09-01T08:00:00+07:00", createdBy: rizz });
  await insertTx(testDb, { kind: "expense", amount: 200_000n, accountId: bca.id, categoryId: c.groceries.id, occurredAt: "2026-09-05T08:00:00+07:00", createdBy: rizz });
  const monthly = (day: number) => `FREQ=MONTHLY;BYMONTHDAY=${day}`;
  await createBill(h.rizz, { name: "Internet", ownerId: rizz, amount: 350_000n, payFromAccountId: bca.id, categoryId: c.transport.id, rrule: monthly(24), nextDueOn: "2026-09-24" }, testDb);
  await createBill(h.rizz, { name: "Sewa", ownerId: rizz, amount: 3_000_000n, payFromAccountId: bca.id, categoryId: c.transport.id, rrule: monthly(1), nextDueOn: "2026-10-01" }, testDb);
  await createBill(h.rizz, { name: "Listrik", ownerId: null, amount: 600_000n, payFromAccountId: shared.id, categoryId: c.transport.id, rrule: monthly(20), nextDueOn: "2026-09-20" }, testDb);
  await createGoal(h.rizz, { name: "Liburan", ownerId: rizz, targetAmount: 12_000_000n, deadline: "2027-03-31" }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: c.food.id, month: "2026-09-01", amount: 1_000_000n, isMandatory: true }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: c.transport.id, month: "2026-09-01", amount: 500_000n }, testDb);
});

afterAll(closeDb);

describe("getDashboard", () => {
  it("Saya: aman dibelanjakan dan komponennya", async () => {
    const d = await getDashboard(h.rizz, "me", now, testDb);
    expect(d.daysToPayday).toMatchObject({ value: 1, nextPayday: "2026-09-25" });
    expect(d.liquid.value).toBe(18_300_000n);
    expect(d.safeToSpend.components).toEqual({ liquid: 18_300_000n, billsDue: 350_000n, goalSetAsides: 2_000_000n, mandatoryRemaining: 800_000n });
    expect(d.safeToSpend.value).toBe(15_150_000n);
    expect(d.safeToSpend.billsDue.map((b) => b.name)).toEqual(["Internet"]);
  });

  it("Saya: arus bulan ini, rasio tabungan, kategori, grafik", async () => {
    const d = await getDashboard(h.rizz, "me", now, testDb);
    expect(d.income.value).toBe(8_000_000n);
    expect(d.expense.value).toBe(200_000n);
    // (8.000.000 - 200.000) / 8.000.000 = 97,5%
    expect(d.savingsRate.value).toBe(97.5);
    expect(d.categories.value.map((c) => [c.name, c.total])).toEqual([["Makan dan minum", 200_000n]]);
    const points = d.dailyBalance.value;
    // saldo akhir 31 Agu 10.500.000; 1 Sep +8.000.000; 5 Sep -200.000; 30 hari September
    expect(points).toHaveLength(30);
    expect(points[0]).toEqual({ day: "2026-09-01", balance: 18_500_000n, projected: false });
    expect(points.find((p) => p.day === "2026-09-24")).toEqual({ day: "2026-09-24", balance: 18_300_000n, projected: false });
    expect(points[24]!.projected).toBe(true);
    expect(d.attention.dueSoonBills.map((b) => b.name)).toEqual(["Internet"]);
    expect(d.topBudgets.map((b) => b.categoryName)).toEqual(["Makan dan minum", "Transportasi"]);
    expect(d.health.map((c) => c.key)).toEqual(["emergency_fund", "savings_rate", "debt_ratio", "overdue_bills"]);
  });

  it("Gabungan: akun Bersama dan tagihan Bersama ikut, gajian terdekat dari kalian berdua", async () => {
    const d = await getDashboard(h.rizz, "all", now, testDb);
    expect(d.liquid.value).toBe(20_300_000n);
    expect(d.daysToPayday.value).toBe(1);
    expect(d.attention.overdueBills.map((b) => b.name)).toEqual(["Listrik"]);
    // 20.300.000 - (Listrik telat 600.000 + Internet 350.000) - 2.000.000 - 800.000 = 16.550.000
    expect(d.safeToSpend.value).toBe(16_550_000n);
  });

  it("Partner tanpa akun: semua nol, gajian Nadia 1 Okt = 7 hari", async () => {
    const d = await getDashboard(h.rizz, "partner", now, testDb);
    expect(d.liquid.value).toBe(0n);
    expect(d.daysToPayday.value).toBe(7);
    expect(d.savingsRate.value).toBeNull();
  });
});

/**
 * Periode lalu (?periode=lalu) pada 24 Sep 2026: Agustus utuh 1-31 Agu, dibanding Juli utuh.
 * Ditambah di 31 Agu: gaji sampingan +1.000.000 dan belanja dapur -300.000 di BCA Rizz; anggaran wajib Agustus 500.000.
 * Pemasukan Agu 1.000.000, pengeluaran 300.000, rasio tabungan (1.000.000 - 300.000) / 1.000.000 = 70%.
 * Saldo 1-30 Agu 0 (akun dibuka 31 Agu); 31 Agu = 10.000.000 + 500.000 + 1.000.000 - 300.000 = 11.200.000.
 * Hero tetap posisi hari ini: likuid 18.300.000 + 700.000 = 19.000.000; 19.000.000 - 350.000 - 2.000.000 - 800.000 = 15.850.000.
 */
describe("getDashboard periode lalu", () => {
  beforeAll(async () => {
    const rizz = h.rizz.user.id;
    await insertTx(testDb, { kind: "income", amount: 1_000_000n, accountId: bcaId, categoryId: c.salary.id, occurredAt: "2026-08-31T09:00:00+07:00", createdBy: rizz });
    await insertTx(testDb, { kind: "expense", amount: 300_000n, accountId: bcaId, categoryId: c.groceries.id, occurredAt: "2026-08-31T12:00:00+07:00", createdBy: rizz });
    await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: c.food.id, month: "2026-08-01", amount: 500_000n, isMandatory: true }, testDb);
  });

  it("metrik, kategori, grafik, dan anggaran memakai Agustus utuh; hero tetap hari ini", async () => {
    const d = await getDashboard(h.rizz, "me", now, testDb, "previous");
    expect(d.period).toBe("previous");
    expect(d.ranges.current.label).toBe("1-31 Agu");
    expect(d.ranges.previous.label).toBe("1-31 Jul");
    expect(d.income.value).toBe(1_000_000n);
    expect(d.expense.value).toBe(300_000n);
    expect(d.savingsRate.value).toBe(70);
    // Juli tanpa transaksi: perubahan tidak bisa dihitung
    expect(d.incomeChange.value).toBeNull();
    expect(d.categories.value.map((x) => [x.name, x.total])).toEqual([["Makan dan minum", 300_000n]]);
    const points = d.dailyBalance.value;
    expect(points).toHaveLength(31);
    expect(points.some((p) => p.projected)).toBe(false);
    expect(points[29]).toEqual({ day: "2026-08-30", balance: 0n, projected: false });
    expect(points[30]).toEqual({ day: "2026-08-31", balance: 11_200_000n, projected: false });
    expect(d.budgetMonth).toBe("2026-08-01");
    expect(d.topBudgets.map((b) => [b.categoryName, b.spent, b.status.value.elapsedPercent])).toEqual([["Makan dan minum", 300_000n, 100]]);
    expect(d.safeToSpend.value).toBe(15_850_000n);
    expect(d.attention.dueSoonBills.map((b) => b.name)).toEqual(["Internet"]);
  });

  it("periode berjalan tidak berubah oleh pilihan periode", async () => {
    const [current, previous] = await Promise.all([
      getDashboard(h.rizz, "me", now, testDb),
      getDashboard(h.rizz, "me", now, testDb, "previous"),
    ]);
    expect(current.period).toBe("current");
    expect(current.ranges.current.label).toBe("1-24 Sep");
    expect(current.budgetMonth).toBe("2026-09-01");
    expect(current.safeToSpend.value).toBe(previous.safeToSpend.value);
    // tren 12 bulan: Okt 2025 sampai Sep 2026, sama di kedua periode
    expect(current.trend.value).toHaveLength(12);
    expect(current.trend.value.at(-1)).toEqual({ month: "2026-09", income: 8_000_000n, expense: 200_000n });
    expect(current.trend.value.at(-2)).toEqual({ month: "2026-08", income: 1_000_000n, expense: 300_000n });
    expect(previous.trend.value).toEqual(current.trend.value);
  });
});
