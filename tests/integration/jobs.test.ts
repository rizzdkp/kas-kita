import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { accounts, attachments, auditLog, billPayments, bills, budgets, notifications, recurringRules, transactionTags, transactions } from "@/server/db/schema";
import { startOfKey } from "@/server/metrics/_time";
import { createBill } from "@/server/mutations/bills";
import { upsertBudget } from "@/server/mutations/budgets";
import { createRecurringRule } from "@/server/mutations/recurring";
import { createTransaction } from "@/server/mutations/transactions";
import { handleBudgetCopyJob } from "@/worker/jobs/budget-copy";
import { handleCreditCardBillsJob } from "@/worker/jobs/credit-card-bills";
import { handleDueNotificationsJob } from "@/worker/jobs/due-notifications";
import { handlePurgeDeletedJob } from "@/worker/jobs/purge-deleted";
import { handleRecurringDraftsJob } from "@/worker/jobs/recurring";

let h: Household;
let c: Awaited<ReturnType<typeof seedBasicCategories>>;

const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  c = await seedBasicCategories(testDb);
});

afterAll(closeDb);

async function notesFor(userId: string, kind: "bill_due" | "budget_over" | "recurring_pending") {
  return testDb
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), eq(notifications.kind, kind)));
}

describe("recurring.create-drafts", () => {
  const now = at("2026-10-03T00:10:00+07:00");

  it("membuat draf untuk semua periode terlewat, memajukan jadwal, memberi tahu pemilik akun sekali", async () => {
    const bank = await createAccountRow(testDb, { name: "BCA Rizz", type: "bank", ownerId: h.rizz.user.id });
    const rule = await createRecurringRule(
      h.rizz,
      { kind: "expense", amount: 300_000n, accountId: bank.id, categoryId: c.transport.id, note: "Parkir bulanan", frequency: "monthly", nextRunOn: "2026-07-31" },
      testDb,
      "2026-07-01",
    );

    const first = await handleRecurringDraftsJob({ now, db: testDb, ruleIds: [rule.id], push: false });
    expect(first).toMatchObject({ rules: 1, created: 3, drafts: 3, failed: 0 });
    const rows = await testDb.select().from(transactions).where(eq(transactions.recurringId, rule.id)).orderBy(transactions.occurredAt);
    expect(rows.map((t) => t.occurredAt.toISOString())).toEqual([
      startOfKey("2026-07-31").toISOString(),
      startOfKey("2026-08-31").toISOString(),
      startOfKey("2026-09-30").toISOString(),
    ]);
    for (const t of rows) {
      expect(t).toMatchObject({ status: "draft", source: "recurring", amount: 300_000n, createdBy: h.rizz.user.id, note: "Parkir bulanan" });
    }
    const [after] = await testDb.select().from(recurringRules).where(eq(recurringRules.id, rule.id));
    expect(after?.nextRunOn).toBe("2026-10-31");
    expect(after?.version).toBe(2);
    const audit = await testDb.select().from(auditLog).where(and(eq(auditLog.entityId, rule.id), eq(auditLog.action, "update")));
    expect(audit[0]?.actorId).toBe(h.rizz.user.id);

    const pending = await notesFor(h.rizz.user.id, "recurring_pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.payload).toMatchObject({ message: "3 transaksi berulang Parkir bulanan menunggu konfirmasi.", href: "/transaksi?status=draft", count: 3 });
    expect(await notesFor(h.nadia.user.id, "recurring_pending")).toHaveLength(0);

    // job diulang di hari yang sama: tidak ada yang jatuh tempo lagi
    expect(await handleRecurringDraftsJob({ now, db: testDb, ruleIds: [rule.id], push: false })).toMatchObject({ rules: 0, created: 0 });
    // next_run_on mundur (misalnya worker mati sebelum commit berikutnya): client_id mencegah dobel
    await testDb.update(recurringRules).set({ nextRunOn: "2026-08-31" }).where(eq(recurringRules.id, rule.id));
    expect(await handleRecurringDraftsJob({ now, db: testDb, ruleIds: [rule.id], push: false })).toMatchObject({ rules: 1, created: 0 });
    expect(await testDb.select().from(transactions).where(eq(transactions.recurringId, rule.id))).toHaveLength(3);
    expect(await notesFor(h.rizz.user.id, "recurring_pending")).toHaveLength(1);
  });

  it("auto-konfirmasi mencatat langsung; saldo tunai kurang turun jadi draf; akun Bersama memberi tahu keduanya", async () => {
    const shared = await createAccountRow(testDb, { name: "Rekening Bersama", type: "bank", ownerId: null, openingBalance: 5_000_000n });
    const cash = await createAccountRow(testDb, { name: "Tunai dapur", type: "cash", ownerId: null, openingBalance: 10_000n });
    const confirmed = await createRecurringRule(
      h.nadia,
      { kind: "expense", amount: 100_000n, accountId: shared.id, categoryId: c.coffee.id, note: "Langganan", frequency: "daily", nextRunOn: "2026-10-03", autoConfirm: true },
      testDb,
      "2026-10-03",
    );
    const fallback = await createRecurringRule(
      h.nadia,
      { kind: "expense", amount: 50_000n, accountId: cash.id, categoryId: c.coffee.id, note: "Galon", frequency: "weekly", nextRunOn: "2026-10-03", autoConfirm: true },
      testDb,
      "2026-10-03",
    );
    const run = await handleRecurringDraftsJob({ now, db: testDb, ruleIds: [confirmed.id, fallback.id], push: false });
    expect(run).toMatchObject({ rules: 2, created: 2, drafts: 1 });
    const [ok] = await testDb.select().from(transactions).where(eq(transactions.recurringId, confirmed.id));
    expect(ok).toMatchObject({ status: "confirmed", createdBy: h.nadia.user.id });
    const [draft] = await testDb.select().from(transactions).where(eq(transactions.recurringId, fallback.id));
    expect(draft?.status).toBe("draft");
    const [ruleAfter] = await testDb.select().from(recurringRules).where(eq(recurringRules.id, fallback.id));
    expect(ruleAfter?.nextRunOn).toBe("2026-10-10");
    for (const userId of [h.rizz.user.id, h.nadia.user.id]) {
      const notes = (await notesFor(userId, "recurring_pending")).filter((n) => (n.payload as { ruleId: string }).ruleId === fallback.id);
      expect(notes).toHaveLength(1);
      expect(notes[0]?.payload).toMatchObject({ message: "Transaksi berulang Galon Rp 50.000, 3 Okt, menunggu konfirmasi.", href: "/transaksi?status=draft&scope=all" });
    }
  });

  it("jadwal terhapus dan template rusak dilewati tanpa menghentikan job", async () => {
    const bank = await createAccountRow(testDb, { name: "Jago Nadia", type: "bank", ownerId: h.nadia.user.id });
    const broken = await createRecurringRule(
      h.nadia,
      { kind: "income", amount: 1_000n, accountId: bank.id, categoryId: c.salary.id, frequency: "monthly", nextRunOn: "2026-10-01" },
      testDb,
      "2026-10-01",
    );
    await testDb.update(recurringRules).set({ template: { kind: "income", amount: 1000 } }).where(eq(recurringRules.id, broken.id));
    const run = await handleRecurringDraftsJob({ now, db: testDb, ruleIds: [broken.id], push: false });
    expect(run).toMatchObject({ invalid: 1, created: 0, failed: 0 });
  });
});

describe("budgets.copy-month", () => {
  it("menyalin anggaran bulan lalu untuk semua pemilik dan aman diulang", async () => {
    for (const scopeOwner of [`user:${h.rizz.user.id}`, `user:${h.nadia.user.id}`, "shared"]) {
      await upsertBudget(h.rizz, { scopeOwner, categoryId: c.food.id, month: "2026-09-01", amount: 1_000_000n, isMandatory: true }, testDb);
    }
    const now = at("2026-10-01T00:05:00+07:00");
    expect(await handleBudgetCopyJob({ now, db: testDb })).toEqual({ copied: 3 });
    expect(await handleBudgetCopyJob({ now, db: testDb })).toEqual({ copied: 0 });
    const october = await testDb.select().from(budgets).where(eq(budgets.month, "2026-10-01"));
    expect(october.map((b) => b.scopeOwner).sort()).toEqual([`user:${h.nadia.user.id}`, `user:${h.rizz.user.id}`, "shared"].sort());
    const nadiaBudget = october.find((b) => b.scopeOwner === `user:${h.nadia.user.id}`);
    const [audit] = await testDb.select().from(auditLog).where(eq(auditLog.entityId, nadiaBudget!.id));
    expect(audit?.actorId).toBe(h.nadia.user.id);
  });
});

describe("bills.credit-card", () => {
  it("memajukan periode kartu kredit bernominal nol yang sudah lewat; yang masih ada nominalnya tetap", async () => {
    const pay = await createAccountRow(testDb, { name: "BCA bayar", type: "bank", ownerId: h.rizz.user.id, openingBalance: 10_000_000n });
    const [idle] = await testDb
      .insert(accounts)
      .values({ name: "Kartu jarang", type: "credit_card", ownerId: h.rizz.user.id, openingBalance: 0n, openingDate: "2026-01-01", statementDay: 20, dueDay: 5 })
      .returning();
    const [used] = await testDb
      .insert(accounts)
      .values({ name: "Kartu harian", type: "credit_card", ownerId: h.rizz.user.id, openingBalance: 0n, openingDate: "2026-01-01", statementDay: 20, dueDay: 1 })
      .returning();
    await insertTx(testDb, { kind: "expense", amount: 1_000_000n, accountId: used!.id, categoryId: c.food.id, occurredAt: "2026-09-10T12:00:00+07:00", createdBy: h.rizz.user.id });
    const base = { ownerId: h.rizz.user.id, payFromAccountId: pay.id, rrule: "FREQ=MONTHLY;BYMONTHDAY=5" };
    const idleBill = await createBill(h.rizz, { ...base, name: "Tagihan kartu jarang", creditCardAccountId: idle!.id, nextDueOn: "2026-08-05" }, testDb);
    const usedBill = await createBill(h.rizz, { ...base, name: "Tagihan kartu harian", creditCardAccountId: used!.id, nextDueOn: "2026-10-01", rrule: "FREQ=MONTHLY;BYMONTHDAY=1" }, testDb);

    const now = at("2026-10-03T01:00:00+07:00");
    expect(await handleCreditCardBillsJob({ now, db: testDb })).toEqual({ checked: 2, advanced: 1 });
    const [idleAfter] = await testDb.select().from(bills).where(eq(bills.id, idleBill.id));
    expect(idleAfter?.nextDueOn).toBe("2026-10-05");
    const [usedAfter] = await testDb.select().from(bills).where(eq(bills.id, usedBill.id));
    expect(usedAfter?.nextDueOn).toBe("2026-10-01");
    expect(await handleCreditCardBillsJob({ now, db: testDb })).toEqual({ checked: 1, advanced: 0 });
  });
});

describe("notifications.due", () => {
  it("tagihan jatuh tempo 3 hari lagi dan anggaran wajib lewat, sekali per periode, Bersama ke keduanya", async () => {
    const bank = await createAccountRow(testDb, { name: "BCA tagihan", type: "bank", ownerId: h.rizz.user.id, openingBalance: 10_000_000n });
    const sharedBank = await createAccountRow(testDb, { name: "Bersama tagihan", type: "bank", ownerId: null, openingBalance: 10_000_000n });
    const base = { payFromAccountId: bank.id, categoryId: c.transport.id, rrule: "FREQ=MONTHLY;BYMONTHDAY=6" };
    await createBill(h.rizz, { ...base, name: "Listrik", ownerId: h.rizz.user.id, amount: 350_000n, nextDueOn: "2026-10-06" }, testDb);
    await createBill(h.rizz, { ...base, name: "Internet", ownerId: null, amount: 400_000n, nextDueOn: "2026-10-04" }, testDb);
    await createBill(h.rizz, { ...base, name: "Asuransi", ownerId: h.rizz.user.id, amount: 500_000n, nextDueOn: "2026-10-10" }, testDb);

    const month = "2026-10-01";
    await upsertBudget(h.rizz, { scopeOwner: `user:${h.rizz.user.id}`, categoryId: c.transport.id, month, amount: 100_000n, isMandatory: true }, testDb);
    await upsertBudget(h.rizz, { scopeOwner: `user:${h.rizz.user.id}`, categoryId: c.salary.id, month, amount: 1n, isMandatory: false }, testDb);
    await upsertBudget(h.rizz, { scopeOwner: "shared", categoryId: c.transport.id, month, amount: 50_000n, isMandatory: true }, testDb);
    await createTransaction(h.rizz, { kind: "expense", amount: 150_000n, accountId: bank.id, categoryId: c.transport.id, occurredAt: at("2026-10-02T09:00:00+07:00") }, testDb);
    await createTransaction(h.rizz, { kind: "expense", amount: 80_000n, accountId: sharedBank.id, categoryId: c.transport.id, occurredAt: at("2026-10-02T10:00:00+07:00") }, testDb);

    const now = at("2026-10-03T08:00:00+07:00");
    const first = await handleDueNotificationsJob({ now, db: testDb, push: false });
    // tagihan: Listrik ke Rizz, Internet ke keduanya; anggaran: transport Rizz ke Rizz, transport Bersama ke keduanya
    expect(first).toEqual({ billDue: 3, budgetOver: 3 });
    expect(await handleDueNotificationsJob({ now, db: testDb, push: false })).toEqual({ billDue: 0, budgetOver: 0 });
    expect(await handleDueNotificationsJob({ now: at("2026-10-04T08:00:00+07:00"), db: testDb, push: false })).toEqual({ billDue: 0, budgetOver: 0 });

    const rizzBills = await notesFor(h.rizz.user.id, "bill_due");
    expect(rizzBills.map((n) => (n.payload as { message: string }).message).sort()).toEqual([
      "Tagihan Internet Rp 400.000 jatuh tempo besok, 4 Okt.",
      "Tagihan Listrik Rp 350.000 jatuh tempo 3 hari lagi, 6 Okt.",
    ]);
    const nadiaBills = await notesFor(h.nadia.user.id, "bill_due");
    expect(nadiaBills).toHaveLength(1);
    const rizzBudgets = await notesFor(h.rizz.user.id, "budget_over");
    expect(rizzBudgets.map((n) => (n.payload as { message: string }).message)).toContain("Anggaran wajib Transportasi lewat Rp 50.000 dari Rp 100.000.");
    expect(await notesFor(h.nadia.user.id, "budget_over")).toHaveLength(1);
  });
});

describe("purge.deleted", () => {
  it("hanya menghapus permanen yang dihapus lebih dari 30 hari, beserta tag, lampiran, dan filenya; audit_log utuh", async () => {
    const bank = await createAccountRow(testDb, { name: "BCA purge", type: "bank", ownerId: h.rizz.user.id, openingBalance: 1_000_000n });
    const orphan = await createAccountRow(testDb, { name: "Akun lama", type: "bank", ownerId: h.rizz.user.id });
    const busy = await createAccountRow(testDb, { name: "Akun terpakai", type: "bank", ownerId: h.rizz.user.id, openingBalance: 100_000n });
    const old = await createTransaction(h.rizz, { kind: "expense", amount: 10_000n, accountId: bank.id, categoryId: c.food.id, occurredAt: at("2026-08-01T10:00:00+07:00"), tagNames: ["lama"] }, testDb);
    const recent = await createTransaction(h.rizz, { kind: "expense", amount: 20_000n, accountId: bank.id, categoryId: c.food.id, occurredAt: at("2026-08-02T10:00:00+07:00") }, testDb);
    await createTransaction(h.rizz, { kind: "expense", amount: 5_000n, accountId: busy.id, categoryId: c.food.id, occurredAt: at("2026-08-02T10:00:00+07:00") }, testDb);
    await testDb.insert(attachments).values({ transactionId: old.id, storageKey: "2026/08/struk-lama.webp", mime: "image/webp", sizeBytes: 10, sha256: "a".repeat(64), uploadedBy: h.rizz.user.id });
    const bill = await createBill(h.rizz, { name: "Air", ownerId: h.rizz.user.id, amount: 10_000n, payFromAccountId: bank.id, categoryId: c.food.id, rrule: "FREQ=MONTHLY;BYMONTHDAY=1", nextDueOn: "2026-09-01" }, testDb);
    await testDb.insert(billPayments).values({ billId: bill.id, periodStart: "2026-08-01", transactionId: old.id });
    const rule = await createRecurringRule(h.rizz, { kind: "expense", amount: 1_000n, accountId: bank.id, categoryId: c.food.id, frequency: "daily", nextRunOn: "2026-10-03" }, testDb, "2026-10-03");

    const now = at("2026-10-03T03:00:00+07:00");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    await testDb.update(transactions).set({ deletedAt: daysAgo(31) }).where(eq(transactions.id, old.id));
    await testDb.update(transactions).set({ deletedAt: daysAgo(29) }).where(eq(transactions.id, recent.id));
    await testDb.update(recurringRules).set({ deletedAt: daysAgo(40) }).where(eq(recurringRules.id, rule.id));
    await testDb.update(accounts).set({ deletedAt: daysAgo(40) }).where(sql`${accounts.id} in (${orphan.id}, ${busy.id})`);
    const auditBefore = await testDb.select({ n: sql<number>`count(*)::int` }).from(auditLog);

    const removed: string[] = [];
    const result = await handlePurgeDeletedJob({ now, db: testDb, removeFile: async (key) => void removed.push(key) });
    expect(result).toMatchObject({ transactions: 1, attachments: 1, recurring_rules: 1, accounts: 1, fileErrors: 0 });
    expect(removed).toEqual(["2026/08/struk-lama.webp"]);

    const left = await testDb.select({ id: transactions.id }).from(transactions).where(sql`${transactions.id} in (${old.id}, ${recent.id})`);
    expect(left.map((t) => t.id)).toEqual([recent.id]);
    expect(await testDb.select().from(transactionTags).where(eq(transactionTags.transactionId, old.id))).toHaveLength(0);
    const [payment] = await testDb.select().from(billPayments).where(eq(billPayments.billId, bill.id));
    expect(payment?.transactionId).toBeNull();
    const accountsLeft = await testDb.select({ id: accounts.id }).from(accounts).where(sql`${accounts.id} in (${orphan.id}, ${busy.id})`);
    expect(accountsLeft.map((a) => a.id)).toEqual([busy.id]);
    const auditAfter = await testDb.select({ n: sql<number>`count(*)::int` }).from(auditLog);
    expect(auditAfter[0]?.n).toBe(auditBefore[0]?.n);

    // diulang: tidak ada lagi yang memenuhi syarat
    expect(await handlePurgeDeletedJob({ now, db: testDb, removeFile: async () => {} })).toMatchObject({ transactions: 0, attachments: 0, accounts: 0 });
  });
});
