import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { auditLog, notifications, recurringRules } from "@/server/db/schema";
import { ConflictError, ValidationError } from "@/server/errors";
import { createRecurringRule, deleteRecurringRule, updateRecurringRule } from "@/server/mutations/recurring";
import { listRecurringRules } from "@/server/queries/recurring";

const TODAY = "2026-10-03";
let h: Household;
let c: Awaited<ReturnType<typeof seedBasicCategories>>;
let rizzBank: { id: string };
let nadiaBank: { id: string };
let sharedBank: { id: string };

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  c = await seedBasicCategories(testDb);
  rizzBank = await createAccountRow(testDb, { name: "BCA Rizz", type: "bank", ownerId: h.rizz.user.id });
  nadiaBank = await createAccountRow(testDb, { name: "Jago Nadia", type: "bank", ownerId: h.nadia.user.id });
  sharedBank = await createAccountRow(testDb, { name: "Rekening Bersama", type: "bank", ownerId: null });
});

afterAll(closeDb);

const rent = () => ({
  kind: "expense" as const,
  amount: "1,5jt",
  accountId: rizzBank.id,
  categoryId: c.transport.id,
  note: "Sewa parkir",
  frequency: "monthly" as const,
  nextRunOn: "2026-10-31",
});

describe("createRecurringRule", () => {
  it("menyimpan template jsonb dengan nominal string, RRULE berjangkar, dan audit insert", async () => {
    const rule = await createRecurringRule(h.rizz, { ...rent(), tagNames: ["rumah", " rumah "] }, testDb, TODAY);
    expect(rule.rrule).toBe("FREQ=MONTHLY;BYMONTHDAY=31");
    expect(rule.nextRunOn).toBe("2026-10-31");
    expect(rule.autoConfirm).toBe(false);
    expect(rule.createdBy).toBe(h.rizz.user.id);
    expect(rule.template).toEqual({
      kind: "expense",
      amount: "1500000",
      accountId: rizzBank.id,
      toAccountId: null,
      categoryId: c.transport.id,
      note: "Sewa parkir",
      beneficiary: "owner",
      tagNames: ["rumah"],
    });
    const audit = await testDb.select().from(auditLog).where(and(eq(auditLog.entity, "recurring_rules"), eq(auditLog.entityId, rule.id)));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("insert");
    expect(audit[0]?.diff).toMatchObject({ rrule: [null, "FREQ=MONTHLY;BYMONTHDAY=31"], next_run_on: [null, "2026-10-31"] });
  });

  it("menolak tanggal lampau, transfer tanpa tujuan, dan kategori yang tidak cocok", async () => {
    await expect(createRecurringRule(h.rizz, { ...rent(), nextRunOn: "2026-10-02" }, testDb, TODAY)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createRecurringRule(h.rizz, { ...rent(), kind: "transfer", categoryId: null }, testDb, TODAY),
    ).rejects.toThrow("Pilih akun tujuan transfer");
    await expect(createRecurringRule(h.rizz, { ...rent(), categoryId: c.salary.id }, testDb, TODAY)).rejects.toThrow("Kategori tidak cocok");
  });
});

describe("updateRecurringRule dan deleteRecurringRule", () => {
  it("menaikkan versi, menolak versi lama, dan memberi tahu pemilik akun dengan diff per field", async () => {
    const rule = await createRecurringRule(h.nadia, { ...rent(), accountId: nadiaBank.id, note: "Internet" }, testDb, TODAY);
    const updated = await updateRecurringRule(
      h.rizz,
      { id: rule.id, version: rule.version, fields: { ...rent(), accountId: nadiaBank.id, note: "Internet", amount: 1_750_000n, autoConfirm: true } },
      testDb,
      TODAY,
    );
    expect(updated.version).toBe(rule.version + 1);
    expect(updated.autoConfirm).toBe(true);
    await expect(
      updateRecurringRule(h.nadia, { id: rule.id, version: rule.version, fields: { ...rent(), accountId: nadiaBank.id } }, testDb, TODAY),
    ).rejects.toBeInstanceOf(ConflictError);

    const [note] = await testDb.select().from(notifications).where(eq(notifications.recipientId, h.nadia.user.id));
    expect(note?.kind).toBe("partner_edit");
    expect((note?.payload as { message: string }).message).toBe("Rizz mengubah Transaksi berulang Internet: Rp 1.500.000 menjadi Rp 1.750.000.");

    const deleted = await deleteRecurringRule(h.rizz, { id: rule.id, version: updated.version }, testDb);
    expect(deleted.deletedAt).not.toBeNull();
    const actions = await testDb.select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.entityId, rule.id));
    expect(actions.map((a) => a.action)).toEqual(["insert", "update", "delete"]);
  });

  it("tanggal tersimpan yang sudah lewat boleh tetap saat mengubah field lain", async () => {
    const rule = await createRecurringRule(h.rizz, { ...rent(), nextRunOn: TODAY }, testDb, TODAY);
    const later = "2026-10-05";
    const updated = await updateRecurringRule(h.rizz, { id: rule.id, version: 1, fields: { ...rent(), nextRunOn: TODAY, note: "Parkir" } }, testDb, later);
    expect(updated.nextRunOn).toBe(TODAY);
    await expect(
      updateRecurringRule(h.rizz, { id: rule.id, version: 2, fields: { ...rent(), nextRunOn: "2026-10-04" } }, testDb, later),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("listRecurringRules", () => {
  it("cakupan mengikuti pemilik akun; Bersama hanya di Gabungan; yang dihapus tidak tampil", async () => {
    await createRecurringRule(h.rizz, { ...rent(), accountId: sharedBank.id, note: "Listrik rumah" }, testDb, TODAY);
    await createRecurringRule(
      h.rizz,
      { kind: "transfer", amount: 500_000n, accountId: rizzBank.id, toAccountId: nadiaBank.id, note: "Kiriman", frequency: "weekly", nextRunOn: "2026-10-05" },
      testDb,
      TODAY,
    );
    const mine = await listRecurringRules(h.rizz, "me", testDb);
    const all = await listRecurringRules(h.rizz, "all", testDb);
    const partner = await listRecurringRules(h.rizz, "partner", testDb);
    expect(mine.map((r) => r.label).sort()).toEqual(["Kiriman", "Parkir", "Sewa parkir"]);
    expect(all.map((r) => r.label)).toContain("Listrik rumah");
    expect(all.map((r) => r.label)).not.toContain("Internet");
    // transfer masuk ke akun Nadia ikut tampil di cakupan Partner
    expect(partner.map((r) => r.label)).toEqual(["Kiriman"]);
    const kiriman = all.find((r) => r.label === "Kiriman");
    expect(kiriman).toMatchObject({ amount: 500_000n, toAccountName: "Jago Nadia", recurrenceLabel: "Mingguan, Senin", frequency: "weekly", pendingDrafts: 0 });
    const shared = all.find((r) => r.label === "Listrik rumah");
    expect(shared?.ownerId).toBeNull();
    const rows = await testDb.select().from(recurringRules);
    expect(rows.length).toBeGreaterThan(all.length);
  });
});
