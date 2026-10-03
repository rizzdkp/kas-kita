import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { listAccounts } from "@/server/queries/accounts";
import { sumFlows } from "@/server/queries/aggregates";
import { listTransactions } from "@/server/queries/transactions";

/**
 * Fixture September 2026:
 *  BCA Rizz saldo awal 10.000.000, Tunai Rizz 500.000, Jago Nadia 5.000.000, Rekening Bersama 0.
 *  1 Sep  Gaji Rizz +8.000.000 ke BCA
 *  2 Sep  BCA Rizz -> Bersama 3.000.000;  Jago Nadia -> Bersama 2.000.000
 *  3 Sep  BCA Rizz -> Tunai Rizz 300.000 (transfer internal Rizz)
 *  4 Sep  Jago Nadia -> BCA Rizz 100.000
 *  5 Sep  BCA Rizz belanja dapur 200.000
 * 10 Sep  Bersama belanja dapur 1.000.000
 * Saldo: BCA 10jt + 8jt - 3jt - 300rb + 100rb - 200rb = 14.600.000; Tunai 800.000;
 *        Jago 5jt - 2jt - 100rb = 2.900.000; Bersama 3jt + 2jt - 1jt = 4.000.000
 */
let h: Household;
type IdKey = "bca" | "cash" | "jago" | "shared" | "salary" | "rizzToShared" | "nadiaToShared" | "internal" | "nadiaToRizz" | "groceries" | "sharedExpense";
const ids = {} as Record<IdKey, string>;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  const c = await seedBasicCategories(testDb);
  const rizzId = h.rizz.user.id;
  const nadiaId = h.nadia.user.id;
  const bca = await createAccountRow(testDb, { name: "BCA Rizz", type: "bank", ownerId: rizzId, openingBalance: 10_000_000n, openingDate: "2026-08-31" });
  const cash = await createAccountRow(testDb, { name: "Tunai Rizz", type: "cash", ownerId: rizzId, openingBalance: 500_000n, openingDate: "2026-08-31" });
  const jago = await createAccountRow(testDb, { name: "Jago Nadia", type: "bank", ownerId: nadiaId, openingBalance: 5_000_000n, openingDate: "2026-08-31" });
  const shared = await createAccountRow(testDb, { name: "Rekening Bersama", type: "bank", ownerId: null, openingDate: "2026-08-31" });
  Object.assign(ids, { bca: bca.id, cash: cash.id, jago: jago.id, shared: shared.id });
  ids.salary = (await insertTx(testDb, { kind: "income", amount: 8_000_000n, accountId: bca.id, categoryId: c.salary.id, occurredAt: "2026-09-01T09:00:00+07:00", createdBy: rizzId })).id;
  ids.rizzToShared = (await insertTx(testDb, { kind: "transfer", amount: 3_000_000n, accountId: bca.id, toAccountId: shared.id, occurredAt: "2026-09-02T09:00:00+07:00", createdBy: rizzId })).id;
  ids.nadiaToShared = (await insertTx(testDb, { kind: "transfer", amount: 2_000_000n, accountId: jago.id, toAccountId: shared.id, occurredAt: "2026-09-02T10:00:00+07:00", createdBy: nadiaId })).id;
  ids.internal = (await insertTx(testDb, { kind: "transfer", amount: 300_000n, accountId: bca.id, toAccountId: cash.id, occurredAt: "2026-09-03T09:00:00+07:00", createdBy: rizzId })).id;
  ids.nadiaToRizz = (await insertTx(testDb, { kind: "transfer", amount: 100_000n, accountId: jago.id, toAccountId: bca.id, occurredAt: "2026-09-04T09:00:00+07:00", createdBy: nadiaId })).id;
  ids.groceries = (await insertTx(testDb, { kind: "expense", amount: 200_000n, accountId: bca.id, categoryId: c.groceries.id, occurredAt: "2026-09-05T09:00:00+07:00", createdBy: rizzId })).id;
  ids.sharedExpense = (await insertTx(testDb, { kind: "expense", amount: 1_000_000n, accountId: shared.id, categoryId: c.groceries.id, occurredAt: "2026-09-10T09:00:00+07:00", createdBy: nadiaId })).id;
});

afterAll(closeDb);

const september = { start: new Date("2026-09-01T00:00:00+07:00"), end: new Date("2026-10-01T00:00:00+07:00") };

describe("cakupan transaksi", () => {
  it("Saya: transfer ke Bersama tampil sebagai transfer keluar, transfer internal ikut daftar tapi bisa disembunyikan", async () => {
    const page = await listTransactions(h.rizz, { scope: "me" }, {}, testDb);
    const byId = new Map(page.rows.map((r) => [r.id, r]));
    expect([...byId.keys()].sort()).toEqual([ids.salary, ids.rizzToShared, ids.internal, ids.nadiaToRizz, ids.groceries].sort());
    expect(byId.get(ids.rizzToShared)).toMatchObject({ flow: "transfer_out", counterpartyAccountName: "Rekening Bersama", ownerId: h.rizz.user.id });
    expect(byId.get(ids.nadiaToRizz)).toMatchObject({ flow: "transfer_in", counterpartyAccountName: "Jago Nadia", ownerId: h.nadia.user.id });
    expect(byId.get(ids.internal)?.flow).toBe("transfer_internal");

    const cashFlow = await listTransactions(h.rizz, { scope: "me", hideInternalTransfers: true }, {}, testDb);
    expect(cashFlow.rows.map((r) => r.id)).not.toContain(ids.internal);
  });

  it("Partner: hanya akun Nadia, transfer ke Bersama dan ke Rizz tampil sebagai transfer keluar", async () => {
    const page = await listTransactions(h.rizz, { scope: "partner" }, {}, testDb);
    expect(page.rows.map((r) => [r.id, r.flow]).sort()).toEqual(
      [
        [ids.nadiaToShared, "transfer_out"],
        [ids.nadiaToRizz, "transfer_out"],
      ].sort(),
    );
    expect(page.rows.find((r) => r.id === ids.nadiaToRizz)?.counterpartyAccountName).toBe("BCA Rizz");
  });

  it("Gabungan: semua transaksi, semua transfer internal", async () => {
    const page = await listTransactions(h.rizz, { scope: "all" }, {}, testDb);
    expect(page.rows).toHaveLength(7);
    for (const r of page.rows.filter((x) => x.kind === "transfer")) expect(r.flow).toBe("transfer_internal");
    const hidden = await listTransactions(h.rizz, { scope: "all", hideInternalTransfers: true }, {}, testDb);
    expect(hidden.rows).toHaveLength(3);
  });

  it("transfer tidak pernah masuk pemasukan atau pengeluaran di cakupan mana pun", async () => {
    // Saya: pemasukan 8.000.000 (gaji), pengeluaran 200.000 (belanja BCA), transfer 3jt ke Bersama tidak dihitung
    expect(await sumFlows(h.rizz, "me", september, testDb)).toMatchObject({ income: 8_000_000n, expense: 200_000n });
    // Partner: Nadia tidak punya pemasukan atau pengeluaran, hanya transfer
    expect(await sumFlows(h.rizz, "partner", september, testDb)).toMatchObject({ income: 0n, expense: 0n });
    // Gabungan: 200.000 + 1.000.000 dari akun Bersama
    expect(await sumFlows(h.rizz, "all", september, testDb)).toMatchObject({ income: 8_000_000n, expense: 1_200_000n });
  });

  it("dari sudut pandang Nadia, Saya dan Partner tertukar", async () => {
    const me = await listTransactions(h.nadia, { scope: "me" }, {}, testDb);
    expect(me.rows.map((r) => r.id).sort()).toEqual([ids.nadiaToShared, ids.nadiaToRizz].sort());
  });
});

describe("cakupan akun dan saldo", () => {
  it("akun Bersama hanya di Gabungan, dan di halaman Akun untuk semua cakupan", async () => {
    const me = await listAccounts(h.rizz, { scope: "me" }, testDb);
    expect(me.all.map((a) => a.name).sort()).toEqual(["BCA Rizz", "Tunai Rizz"]);
    const all = await listAccounts(h.rizz, { scope: "all" }, testDb);
    expect(all.all).toHaveLength(4);
    const page = await listAccounts(h.rizz, { scope: "partner", view: "accounts_page" }, testDb);
    expect(page.all.map((a) => a.name).sort()).toEqual(["Jago Nadia", "Rekening Bersama"]);
  });

  it("saldo = saldo awal + masuk - keluar", async () => {
    const all = await listAccounts(h.rizz, { scope: "all" }, testDb);
    const balance = Object.fromEntries(all.all.map((a) => [a.name, a.balance]));
    expect(balance).toEqual({
      "BCA Rizz": 14_600_000n,
      "Tunai Rizz": 800_000n,
      "Jago Nadia": 2_900_000n,
      "Rekening Bersama": 4_000_000n,
    });
  });

  it("filter teks, akun, kategori, pencatat, dan pagination keyset", async () => {
    const byCreator = await listTransactions(h.rizz, { scope: "all", createdBy: [h.nadia.user.id] }, {}, testDb);
    expect(byCreator.rows).toHaveLength(3);
    const byAccount = await listTransactions(h.rizz, { scope: "all", accountIds: [ids.cash] }, {}, testDb);
    expect(byAccount.rows.map((r) => r.id)).toEqual([ids.internal]);
    const byText = await listTransactions(h.rizz, { scope: "all", q: "dapur" }, {}, testDb);
    expect(byText.rows).toHaveLength(2);

    const first = await listTransactions(h.rizz, { scope: "all" }, { limit: 4 }, testDb);
    expect(first.rows).toHaveLength(4);
    const second = await listTransactions(h.rizz, { scope: "all" }, { limit: 4, cursor: first.nextCursor }, testDb);
    expect(second.rows).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(7);
  });
});
