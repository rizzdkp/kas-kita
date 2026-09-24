import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, insertTx, type Household } from "../helpers/fixtures";
import { auditLog, notifications, transactions } from "@/server/db/schema";
import { ConflictError, ValidationError } from "@/server/errors";
import { createValuation, deleteValuation, updateValuation } from "@/server/mutations/investments";
import { getContributedCapital, listInvestments, listValuations } from "@/server/queries/investments";

let h: Household;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
});

afterAll(closeDb);

async function auditFor(entityId: string) {
  return testDb
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, "investment_valuations"), eq(auditLog.entityId, entityId)))
    .orderBy(auditLog.at, auditLog.id);
}

async function reksaFixture() {
  const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 10_000_000n });
  const reksa = await createAccountRow(testDb, { name: "Reksa", type: "investment", ownerId: h.rizz.user.id, openingBalance: 1_000_000n });
  const by = h.rizz.user.id;
  await insertTx(testDb, { kind: "transfer", amount: 2_000_000n, accountId: bca.id, toAccountId: reksa.id, occurredAt: "2026-02-05T09:00:00+07:00", createdBy: by });
  await insertTx(testDb, { kind: "transfer", amount: 500_000n, accountId: bca.id, toAccountId: reksa.id, occurredAt: "2026-03-05T09:00:00+07:00", createdBy: by });
  await insertTx(testDb, { kind: "transfer", amount: 300_000n, accountId: reksa.id, toAccountId: bca.id, occurredAt: "2026-04-05T09:00:00+07:00", createdBy: by });
  // tidak dihitung: draf, dihapus, dan sebelum tanggal saldo awal
  await insertTx(testDb, { kind: "transfer", amount: 700_000n, accountId: bca.id, toAccountId: reksa.id, occurredAt: "2026-04-10T09:00:00+07:00", createdBy: by, status: "draft" });
  const deleted = await insertTx(testDb, { kind: "transfer", amount: 900_000n, accountId: bca.id, toAccountId: reksa.id, occurredAt: "2026-04-11T09:00:00+07:00", createdBy: by });
  await testDb.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, deleted.id));
  await insertTx(testDb, { kind: "transfer", amount: 400_000n, accountId: bca.id, toAccountId: reksa.id, occurredAt: "2025-12-20T09:00:00+07:00", createdBy: by });
  return { bca, reksa };
}

describe("modal disetor dan imbal hasil", () => {
  it("modal = saldo awal + transfer masuk - transfer keluar; imbal hasil dari valuasi terakhir", async () => {
    const { reksa } = await reksaFixture();
    // modal = 1.000.000 + (2.000.000 + 500.000) - 300.000 = 3.200.000
    const capital = await getContributedCapital([reksa.id], testDb);
    expect(capital.get(reksa.id)).toBe(3_200_000n);

    await createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-03-31", marketValue: 3_300_000n, note: null }, testDb);
    await createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-06-30", marketValue: 3_520_000n, note: "Laporan Juni" }, testDb);

    const [summary] = await listInvestments(h.rizz, "me", testDb);
    // nilai terakhir 3.520.000 - modal 3.200.000 = 320.000; 320.000 / 3.200.000 = 10%
    expect(summary?.marketValue).toBe(3_520_000n);
    expect(summary?.valuedOn).toBe("2026-06-30");
    expect(summary?.returnAmount).toBe(320_000n);
    expect(summary?.returnPercent).toBe(10);
    expect(summary?.valuations.map((v) => v.valuedOn)).toEqual(["2026-03-31", "2026-06-30"]);
  });

  it("imbal hasil negatif dan tanpa valuasi", async () => {
    const { reksa } = await reksaFixture();
    const [empty] = await listInvestments(h.rizz, "me", testDb);
    expect(empty?.marketValue).toBeNull();
    expect(empty?.returnAmount).toBeNull();
    expect(empty?.returnPercent).toBeNull();

    // 2.880.000 - 3.200.000 = -320.000; -320.000 / 3.200.000 = -10%
    await createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-05-31", marketValue: 2_880_000n, note: null }, testDb);
    const [summary] = await listInvestments(h.rizz, "me", testDb);
    expect(summary?.returnAmount).toBe(-320_000n);
    expect(summary?.returnPercent).toBe(-10);
  });

  it("akun investasi Bersama hanya di Gabungan, milik partner hanya di Partner", async () => {
    await createAccountRow(testDb, { name: "Emas Bersama", type: "investment", ownerId: null });
    await createAccountRow(testDb, { name: "Saham Nadia", type: "investment", ownerId: h.nadia.user.id });
    const names = async (scope: "me" | "partner" | "all") => (await listInvestments(h.rizz, scope, testDb)).map((s) => s.account.name).sort();
    expect(await names("me")).toEqual([]);
    expect(await names("partner")).toEqual(["Saham Nadia"]);
    expect(await names("all")).toEqual(["Emas Bersama", "Saham Nadia"]);
  });
});

describe("mutasi valuasi", () => {
  it("insert, update, delete tercatat di audit dengan diff yang benar", async () => {
    const { reksa } = await reksaFixture();
    const created = await createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-06-30", marketValue: 3_520_000n, note: "Laporan Juni" }, testDb);
    const updated = await updateValuation(h.rizz, { id: created.id, version: 1, patch: { marketValue: 3_600_000n } }, testDb);
    expect(updated.version).toBe(2);
    expect(updated.note).toBe("Laporan Juni");
    await deleteValuation(h.rizz, { id: created.id, version: 2 }, testDb);

    const log = await auditFor(created.id);
    expect(log.map((l) => l.action)).toEqual(["insert", "update", "delete"]);
    expect(log[0]!.diff).toMatchObject({ market_value: [null, "3520000"], valued_on: [null, "2026-06-30"], note: [null, "Laporan Juni"] });
    expect(log[1]!.diff).toEqual({ market_value: ["3520000", "3600000"] });
    expect(Object.keys(log[2]!.diff as object)).toEqual(["deleted_at"]);
    expect((await listValuations([reksa.id], testDb)).get(reksa.id)).toEqual([]);
  });

  it("dua update dengan versi sama, yang kedua ditolak", async () => {
    const { reksa } = await reksaFixture();
    const created = await createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-06-30", marketValue: 3_520_000n, note: null }, testDb);
    await updateValuation(h.rizz, { id: created.id, version: 1, patch: { marketValue: 3_600_000n } }, testDb);
    const stale = updateValuation(h.nadia, { id: created.id, version: 1, patch: { marketValue: 3_700_000n } }, testDb);
    await expect(stale).rejects.toBeInstanceOf(ConflictError);
    await expect(deleteValuation(h.nadia, { id: created.id, version: 1 }, testDb)).rejects.toBeInstanceOf(ConflictError);
    expect((await listValuations([reksa.id], testDb)).get(reksa.id)?.[0]?.marketValue).toBe(3_600_000n);
  });

  it("partner yang mengubah valuasi memicu notifikasi ke pemilik akun", async () => {
    const { reksa } = await reksaFixture();
    const created = await createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-06-30", marketValue: 3_520_000n, note: null }, testDb);
    await updateValuation(h.nadia, { id: created.id, version: 1, patch: { marketValue: 3_600_000n } }, testDb);
    const inbox = await testDb.select().from(notifications).where(eq(notifications.recipientId, h.rizz.user.id));
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.payload).toMatchObject({ entity: "investment_valuations", actorName: "Nadia", action: "update" });
  });

  it("menolak akun bukan investasi, tanggal setelah hari ini, dan nilai negatif", async () => {
    const { bca, reksa } = await reksaFixture();
    await expect(createValuation(h.rizz, { accountId: bca.id, valuedOn: "2026-06-30", marketValue: 1n, note: null }, testDb)).rejects.toBeInstanceOf(ValidationError);
    await expect(createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2999-01-01", marketValue: 1n, note: null }, testDb)).rejects.toThrow("setelah hari ini");
    await expect(createValuation(h.rizz, { accountId: reksa.id, valuedOn: "2026-06-30", marketValue: -1n, note: null }, testDb)).rejects.toThrow("tidak boleh negatif");
    expect(await testDb.select().from(auditLog).where(eq(auditLog.entity, "investment_valuations"))).toHaveLength(0);
  });
});
