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
const now = new Date("2026-09-24T10:00:00+07:00");

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  const c = await seedBasicCategories(testDb);
  const rizz = h.rizz.user.id;
  const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: rizz, openingBalance: 10_000_000n, openingDate: "2026-08-31" });
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
