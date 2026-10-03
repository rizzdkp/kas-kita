import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createCategoryRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { addDaysKey } from "@/server/metrics/_time";
import { createBill, payBill } from "@/server/mutations/bills";
import { upsertBudget } from "@/server/mutations/budgets";
import { getMonthEndForecast } from "@/server/queries/forecast";

/**
 * Hari ini 24 Sep 2026 10.00 WIB. Transaksi pertama Rizz 15 Agu -> 40 hari data (15 Agu sampai 23 Sep).
 * Jendela 40 hari; lima minggu penuh dihitung mundur dari 23 Sep, 15-19 Agu dibuang:
 *   B1 17-23 Sep, B2 10-16 Sep, B3 3-9 Sep, B4 27 Agu-2 Sep, B5 20-26 Agu
 * Fleksibel: Belanja dapur 70.000 setiap hari 15 Agu-23 Sep -> 490.000 per minggu
 *   + 700.000 pada 20 Sep (B1 = 1.190.000), + 350.000 pada 12 Sep (B2 = 840.000)
 * Tidak dihitung ke rata-rata: Sewa 2.000.000 (1 Sep, kategori beranggaran wajib),
 *   pembayaran tagihan Internet 350.000 (10 Sep), pengeluaran Nadia, transfer.
 * Mingguan urut: 490k, 490k, 490k, 840k, 1.190k (n = 5)
 *   P25 posisi 1 -> 490.000 / 7 = 70.000 per hari; P75 posisi 3 -> 840.000 / 7 = 120.000 per hari
 * Terpakai 1-24 Sep = 23 × 70.000 + 700.000 + 350.000 + 2.000.000 + 350.000 = 5.010.000
 * Tagihan sisa bulan: Listrik 400.000 (28 Sep). Kartu kredit (27 Sep) dan Asuransi (5 Okt) tidak ikut.
 * Sisa hari 25-30 Sep = 6
 * Rendah = 5.010.000 + 400.000 + 6 × 70.000 = 5.830.000
 * Tinggi = 5.010.000 + 400.000 + 6 × 120.000 = 6.130.000
 */
let h: Household;
const now = new Date("2026-09-24T10:00:00+07:00");

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  const c = await seedBasicCategories(testDb);
  const housing = await createCategoryRow(testDb, { name: "Tempat tinggal", kind: "expense" });
  const rizz = h.rizz.user.id;
  const nadia = h.nadia.user.id;
  const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: rizz, openingBalance: 50_000_000n, openingDate: "2026-08-01" });
  const card = await createAccountRow(testDb, { name: "Kartu", type: "credit_card", ownerId: rizz, openingDate: "2026-08-01" });
  const jago = await createAccountRow(testDb, { name: "Jago", type: "bank", ownerId: nadia, openingBalance: 5_000_000n, openingDate: "2026-08-01" });

  for (let day = "2026-08-15"; day <= "2026-09-23"; day = addDaysKey(day, 1)) {
    await insertTx(testDb, { kind: "expense", amount: 70_000n, accountId: bca.id, categoryId: c.groceries.id, occurredAt: `${day}T12:00:00+07:00`, createdBy: rizz });
  }
  await insertTx(testDb, { kind: "expense", amount: 700_000n, accountId: bca.id, categoryId: c.transport.id, occurredAt: "2026-09-20T09:00:00+07:00", createdBy: rizz });
  await insertTx(testDb, { kind: "expense", amount: 350_000n, accountId: bca.id, categoryId: c.coffee.id, occurredAt: "2026-09-12T09:00:00+07:00", createdBy: rizz });
  await insertTx(testDb, { kind: "expense", amount: 2_000_000n, accountId: bca.id, categoryId: housing.id, occurredAt: "2026-09-01T09:00:00+07:00", createdBy: rizz });
  await insertTx(testDb, { kind: "transfer", amount: 900_000n, accountId: bca.id, toAccountId: card.id, occurredAt: "2026-09-05T09:00:00+07:00", createdBy: rizz });
  await insertTx(testDb, { kind: "expense", amount: 5_000_000n, accountId: jago.id, categoryId: c.groceries.id, occurredAt: "2026-09-14T09:00:00+07:00", createdBy: nadia });
  await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: housing.id, month: "2026-09-01", amount: 2_000_000n, isMandatory: true }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: c.food.id, month: "2026-09-01", amount: 3_000_000n }, testDb);

  const monthly = (d: number) => `FREQ=MONTHLY;BYMONTHDAY=${d}`;
  const internet = await createBill(h.rizz, { name: "Internet", ownerId: rizz, amount: 350_000n, payFromAccountId: bca.id, categoryId: c.transport.id, rrule: monthly(10), nextDueOn: "2026-09-10" }, testDb);
  await payBill(h.rizz, { id: internet.id, version: internet.version, paidAt: new Date("2026-09-10T09:00:00+07:00") }, testDb);
  await createBill(h.rizz, { name: "Listrik", ownerId: rizz, amount: 400_000n, amountIsEstimate: true, payFromAccountId: bca.id, categoryId: c.transport.id, rrule: monthly(28), nextDueOn: "2026-09-28" }, testDb);
  await createBill(h.rizz, { name: "Asuransi", ownerId: rizz, amount: 250_000n, payFromAccountId: bca.id, categoryId: c.transport.id, rrule: monthly(5), nextDueOn: "2026-10-05" }, testDb);
  await createBill(h.rizz, { name: "Kartu", ownerId: rizz, payFromAccountId: bca.id, creditCardAccountId: card.id, rrule: monthly(27), nextDueOn: "2026-09-27" }, testDb);
});

afterAll(closeDb);

describe("getMonthEndForecast", () => {
  it("Saya: rentang dari data 90 hari terakhir, tagihan, dan terpakai", async () => {
    const m = await getMonthEndForecast(h.rizz, "me", now, testDb);
    expect(m.value).toEqual({
      available: true,
      low: 5_830_000n,
      high: 6_130_000n,
      spentSoFar: 5_010_000n,
      billsRemaining: 400_000n,
      remainingDays: 6,
      dailyLow: 70_000n,
      dailyHigh: 120_000n,
      weeks: 5,
      windowDays: 40,
      dataDays: 40,
    });
    expect(m.inputs["Tagihan Listrik (2026-09-28)"]).toBe(400_000n);
  });

  it("Partner dengan data 10 hari: prediksi belum tersedia", async () => {
    const m = await getMonthEndForecast(h.rizz, "partner", now, testDb);
    expect(m.value).toEqual({ available: false, dataDays: 10, requiredDays: 30 });
  });
});
