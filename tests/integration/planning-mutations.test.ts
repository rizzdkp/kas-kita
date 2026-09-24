import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, getTx, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { auditLog, billPayments, notifications } from "@/server/db/schema";
import { ConflictError, DomainError } from "@/server/errors";
import { archiveAccount, createAccount, deleteAccount, updateAccount } from "@/server/mutations/accounts";
import { createBill, payBill } from "@/server/mutations/bills";
import { upsertBudget } from "@/server/mutations/budgets";
import { archiveCategory, createCategory, updateCategory } from "@/server/mutations/categories";
import { contributeToGoal, createGoal, setGoalAchieved } from "@/server/mutations/goals";
import { reconcileAccount } from "@/server/mutations/reconcile";
import { getAccount } from "@/server/queries/accounts";
import { sumFlows } from "@/server/queries/aggregates";
import { listBills } from "@/server/queries/bills";
import { listBudgets } from "@/server/queries/budgets";
import { listGoals } from "@/server/queries/goals";

let h: Household;
let cats: Awaited<ReturnType<typeof seedBasicCategories>>;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  cats = await seedBasicCategories(testDb);
});

afterAll(closeDb);

async function auditActions(entity: string, entityId: string) {
  const rows = await testDb.select().from(auditLog).where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId))).orderBy(auditLog.at);
  return rows;
}

describe("akun", () => {
  it("create, ganti pemilik, arsip tercatat di audit; hapus ditolak kalau ada transaksi", async () => {
    const acc = await createAccount(h.rizz, { name: "Jago", type: "bank", ownerId: h.rizz.user.id, openingBalance: "250000", openingDate: "2026-09-01" }, testDb);
    const moved = await updateAccount(h.rizz, { id: acc.id, version: 1, patch: { ownerId: null } }, testDb);
    const archived = await archiveAccount(h.rizz, { id: acc.id, version: moved.version }, testDb);
    expect(archived.archivedAt).not.toBeNull();
    const log = await auditActions("accounts", acc.id);
    expect(log.map((l) => l.action)).toEqual(["insert", "update", "update"]);
    expect(log[0]!.diff).toMatchObject({ opening_balance: [null, "250000"], name: [null, "Jago"] });
    expect(log[1]!.diff).toEqual({ owner_id: [h.rizz.user.id, null] });

    await insertTx(testDb, { kind: "expense", amount: 1_000n, accountId: acc.id, categoryId: cats.coffee.id, occurredAt: "2026-09-02T10:00:00+07:00", createdBy: h.rizz.user.id });
    await expect(deleteAccount(h.rizz, { id: acc.id, version: archived.version }, testDb)).rejects.toThrow("tidak bisa dihapus");
  });

  it("akun tanpa transaksi bisa dihapus; Tunai selalu allow_negative false", async () => {
    const cash = await createAccount(h.rizz, { name: "Dompet", type: "cash", ownerId: h.rizz.user.id, openingDate: "2026-09-01", allowNegative: true }, testDb);
    expect(cash.allowNegative).toBe(false);
    const deleted = await deleteAccount(h.rizz, { id: cash.id, version: 1 }, testDb);
    expect(deleted.deletedAt).not.toBeNull();
    expect((await auditActions("accounts", cash.id)).map((l) => l.action)).toEqual(["insert", "delete"]);
  });

  it("mengubah akun milik partner memberi notifikasi ke partner", async () => {
    const acc = await createAccount(h.nadia, { name: "GoPay", type: "ewallet", ownerId: h.nadia.user.id, openingDate: "2026-09-01" }, testDb);
    await updateAccount(h.rizz, { id: acc.id, version: 1, patch: { name: "GoPay Nadia" } }, testDb);
    const [n] = await testDb.select().from(notifications);
    expect(n).toMatchObject({ recipientId: h.nadia.user.id, kind: "partner_edit" });
  });
});

describe("rekonsiliasi", () => {
  it("selisih dicatat sebagai Penyesuaian saldo dan tidak masuk pemasukan atau pengeluaran", async () => {
    const acc = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 1_000_000n, openingDate: "2026-09-01" });
    const at = new Date("2026-09-15T10:00:00+07:00");
    // tercatat 1.000.000, di aplikasi bank 950.000: penyesuaian pengeluaran 50.000
    const result = await reconcileAccount(h.rizz, { accountId: acc.id, version: 1, actualBalance: 950_000n, at }, testDb);
    expect(result).toMatchObject({ recorded: 1_000_000n, actual: 950_000n, difference: -50_000n });
    expect(result.adjustment).toMatchObject({ kind: "expense", amount: 50_000n, categoryId: cats.adjustment.id, source: "adjustment" });
    const account = await getAccount(acc.id, testDb);
    expect(account.balance).toBe(950_000n);
    expect(account.lastReconciledAt?.toISOString()).toBe(at.toISOString());
    const flows = await sumFlows(h.rizz, "me", { start: new Date("2026-09-01T00:00:00+07:00"), end: new Date("2026-10-01T00:00:00+07:00") }, testDb);
    expect(flows).toMatchObject({ income: 0n, expense: 0n });
    expect((await auditActions("transactions", result.adjustment!.id)).map((l) => l.action)).toEqual(["insert"]);
  });
});

describe("kategori", () => {
  it("create, update, arsip teraudit; kategori sistem tidak bisa diubah", async () => {
    const c = await createCategory(h.rizz, { name: "Hewan", kind: "expense", icon: "paw-print" }, testDb);
    const u = await updateCategory(h.rizz, { id: c.id, version: 1, patch: { name: "Hewan peliharaan" } }, testDb);
    await archiveCategory(h.rizz, { id: c.id, version: u.version }, testDb);
    const log = await auditActions("categories", c.id);
    expect(log.map((l) => l.action)).toEqual(["insert", "update", "update"]);
    expect(log[1]!.diff).toEqual({ name: ["Hewan", "Hewan peliharaan"] });
    await expect(archiveCategory(h.rizz, { id: cats.adjustment.id, version: 1 }, testDb)).rejects.toThrow("Kategori sistem");
    await expect(createCategory(h.rizz, { name: "X", kind: "expense", parentId: cats.groceries.id }, testDb)).rejects.toThrow("dua tingkat");
  });
});

describe("anggaran", () => {
  it("upsert membuat lalu memperbarui satu baris, versi lama ditolak", async () => {
    const scopeOwner = `user:${h.rizz.user.id}`;
    const a = await upsertBudget(h.rizz, { scopeOwner, categoryId: cats.food.id, month: "2026-09-14", amount: 2_000_000n, isMandatory: true }, testDb);
    expect(a.month).toBe("2026-09-01");
    const b = await upsertBudget(h.rizz, { scopeOwner, categoryId: cats.food.id, month: "2026-09-01", amount: 2_500_000n, isMandatory: true, version: 1 }, testDb);
    expect(b.id).toBe(a.id);
    await expect(
      upsertBudget(h.rizz, { scopeOwner, categoryId: cats.food.id, month: "2026-09-01", amount: 1n, version: 1 }, testDb),
    ).rejects.toBeInstanceOf(ConflictError);
    const log = await auditActions("budgets", a.id);
    expect(log.map((l) => l.action)).toEqual(["insert", "update"]);
    expect(log[1]!.diff).toEqual({ amount: ["2000000", "2500000"] });
  });

  it("terpakai menjumlahkan subkategori milik pemilik anggaran saja", async () => {
    const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 10_000_000n });
    const jago = await createAccountRow(testDb, { name: "Jago", type: "bank", ownerId: h.nadia.user.id, openingBalance: 10_000_000n });
    await upsertBudget(h.rizz, { scopeOwner: `user:${h.rizz.user.id}`, categoryId: cats.food.id, month: "2026-09-01", amount: 1_000_000n }, testDb);
    for (const [acc, cat, amount] of [
      [bca.id, cats.groceries.id, 600_000n],
      [bca.id, cats.coffee.id, 250_000n],
      [jago.id, cats.groceries.id, 999_000n],
    ] as const) {
      await insertTx(testDb, { kind: "expense", amount, accountId: acc, categoryId: cat, occurredAt: "2026-09-10T10:00:00+07:00", createdBy: h.rizz.user.id });
    }
    const [budget] = await listBudgets(h.rizz, "me", { month: "2026-09-01", today: "2026-09-12" }, testDb);
    // 600.000 + 250.000 = 850.000 dari 1.000.000 = 85% -> mendekati
    expect(budget!.spent).toBe(850_000n);
    expect(budget!.status.value.state).toBe("near");
    expect(await listBudgets(h.rizz, "partner", { month: "2026-09-01", today: "2026-09-12" }, testDb)).toHaveLength(0);
  });
});

describe("tagihan", () => {
  it("bayar tagihan biasa: transaksi pengeluaran, bill_payments, jatuh tempo maju sebulan", async () => {
    const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 5_000_000n });
    const bill = await createBill(
      h.rizz,
      { name: "Listrik", ownerId: null, amount: 500_000n, amountIsEstimate: true, payFromAccountId: bca.id, categoryId: cats.groceries.id, rrule: "FREQ=MONTHLY;BYMONTHDAY=31", nextDueOn: "2026-01-31" },
      testDb,
    );
    const { bill: after, transaction } = await payBill(h.rizz, { id: bill.id, version: 1, paidAt: new Date("2026-01-30T10:00:00+07:00") }, testDb);
    expect(after.nextDueOn).toBe("2026-02-28");
    expect(transaction).toMatchObject({ kind: "expense", amount: 500_000n, accountId: bca.id });
    const payments = await testDb.select().from(billPayments).where(eq(billPayments.billId, bill.id));
    expect(payments).toMatchObject([{ periodStart: "2026-01-31", transactionId: transaction.id }]);
    expect((await auditActions("bills", bill.id)).map((l) => l.action)).toEqual(["insert", "update"]);
    await expect(payBill(h.rizz, { id: bill.id, version: 1 }, testDb)).rejects.toBeInstanceOf(ConflictError);
  });

  it("tagihan kartu kredit dihitung dari saldo saat cetak dan dibayar dengan transfer", async () => {
    const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 5_000_000n });
    const card = await createAccountRow(testDb, { name: "Kartu", type: "credit_card", ownerId: h.rizz.user.id });
    // cetak tanggal 5, jatuh tempo 20: belanja 1 Sep 300.000 dan 4 Sep 200.000 masuk tagihan, 6 Sep 99.000 masuk siklus berikutnya
    for (const [day, amount] of [["01", 300_000n], ["04", 200_000n], ["06", 99_000n]] as const) {
      await insertTx(testDb, { kind: "expense", amount, accountId: card.id, categoryId: cats.coffee.id, occurredAt: `2026-09-${day}T10:00:00+07:00`, createdBy: h.rizz.user.id });
    }
    const { accounts } = await import("@/server/db/schema");
    await testDb.update(accounts).set({ statementDay: 5, dueDay: 20 }).where(eq(accounts.id, card.id));
    const bill = await createBill(
      h.rizz,
      { name: "Kartu kredit", ownerId: h.rizz.user.id, payFromAccountId: bca.id, creditCardAccountId: card.id, rrule: "FREQ=MONTHLY;BYMONTHDAY=20", nextDueOn: "2026-09-20" },
      testDb,
    );
    const [listed] = await listBills(h.rizz, "me", { today: "2026-09-18" }, testDb);
    expect(listed).toMatchObject({ amount: 500_000n, daysUntilDue: 2, overdue: false });
    const { transaction } = await payBill(h.rizz, { id: bill.id, version: 1 }, testDb);
    expect(transaction).toMatchObject({ kind: "transfer", amount: 500_000n, accountId: bca.id, toAccountId: card.id, categoryId: null });
    expect((await getAccount(card.id, testDb)).balance).toBe(-99_000n);
    expect((await getTx(testDb, transaction.id)).status).toBe("confirmed");
  });
});

describe("target", () => {
  it("setoran manual teraudit, progres dan setoran bulanan yang dibutuhkan", async () => {
    const goal = await createGoal(h.rizz, { name: "Liburan", ownerId: null, targetAmount: 12_000_000n, deadline: "2027-03-31" }, testDb);
    const c = await contributeToGoal(h.rizz, { goalId: goal.id, amount: 3_000_000n, contributedAt: new Date("2026-09-10T10:00:00+07:00") }, testDb);
    expect((await auditActions("goal_contributions", c.id)).map((l) => l.action)).toEqual(["insert"]);
    const { active } = await listGoals(h.rizz, "all", { today: "2026-09-24", contributedSince: "2026-09-01" }, testDb);
    // sisa 9.000.000, Sep -> Mar = 6 bulan, 1.500.000 per bulan; setoran sejak 1 Sep 3.000.000
    expect(active[0]).toMatchObject({ progress: 3_000_000n, remaining: 9_000_000n, monthsLeft: 6, requiredMonthly: 1_500_000n, contributedSince: 3_000_000n, progressPercent: 25 });
    expect(await listGoals(h.rizz, "me", { today: "2026-09-24" }, testDb)).toEqual({ active: [], achieved: [] });

    await setGoalAchieved(h.rizz, { id: goal.id, version: 1, achieved: true }, testDb);
    const after = await listGoals(h.rizz, "all", { today: "2026-09-24" }, testDb);
    expect(after.active).toHaveLength(0);
    expect(after.achieved).toHaveLength(1);
  });

  it("target dengan akun penampung menolak setoran manual dan memakai saldo akun", async () => {
    const saving = await createAccountRow(testDb, { name: "Tabungan", type: "bank", ownerId: h.rizz.user.id, openingBalance: 4_000_000n });
    const goal = await createGoal(h.rizz, { name: "Dana darurat", ownerId: h.rizz.user.id, targetAmount: 20_000_000n, linkedAccountId: saving.id }, testDb);
    await expect(contributeToGoal(h.rizz, { goalId: goal.id, amount: 1n }, testDb)).rejects.toBeInstanceOf(DomainError);
    const { active } = await listGoals(h.rizz, "me", { today: "2026-09-24" }, testDb);
    expect(active[0]).toMatchObject({ progress: 4_000_000n, progressPercent: 20, requiredMonthly: null });
  });
});
