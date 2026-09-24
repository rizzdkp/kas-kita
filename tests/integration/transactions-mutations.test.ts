import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { auditLog, notifications } from "@/server/db/schema";
import { ConflictError, InsufficientBalanceError, ValidationError } from "@/server/errors";
import {
  createTransaction,
  createTransactions,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from "@/server/mutations/transactions";
import { getTransaction, listTransactions } from "@/server/queries/transactions";

let h: Household;
let cats: Awaited<ReturnType<typeof seedBasicCategories>>;
let cashId: string;
let bcaId: string;
let nadiaCashId: string;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  cats = await seedBasicCategories(testDb);
  cashId = (await createAccountRow(testDb, { name: "Tunai", type: "cash", ownerId: h.rizz.user.id, openingBalance: 40_000n })).id;
  bcaId = (await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 1_000_000n })).id;
  nadiaCashId = (await createAccountRow(testDb, { name: "Tunai Nadia", type: "cash", ownerId: h.nadia.user.id, openingBalance: 500_000n })).id;
});

afterAll(closeDb);

const at = new Date("2026-09-12T12:00:00+07:00");

async function auditFor(entityId: string) {
  return testDb.select().from(auditLog).where(and(eq(auditLog.entity, "transactions"), eq(auditLog.entityId, entityId))).orderBy(auditLog.at);
}

describe("saldo Tunai", () => {
  it("menolak pengeluaran yang membuat Tunai negatif dengan pesan COPY.md", async () => {
    const attempt = createTransaction(h.rizz, { kind: "expense", amount: 50_000n, accountId: cashId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    await expect(attempt).rejects.toBeInstanceOf(InsufficientBalanceError);
    await expect(attempt).rejects.toThrow("Saldo Tunai tinggal Rp 40.000. Kurangi nominal atau catat dari akun lain.");
  });

  it("mengizinkan tepat sampai nol, dan memperhitungkan beberapa baris quick-add sekaligus", async () => {
    await createTransaction(h.rizz, { kind: "expense", amount: 40_000n, accountId: cashId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    await expect(
      createTransactions(
        h.rizz,
        [
          { kind: "expense", amount: 600_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at },
          { kind: "expense", amount: 500_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at },
        ],
        testDb,
      ),
    ).rejects.toThrow("Saldo BCA tinggal Rp 1.000.000.");
  });

  it("transfer keluar dari Tunai juga dicek, edit nominal dicek terhadap saldo tanpa transaksi lama", async () => {
    await expect(
      createTransaction(h.rizz, { kind: "transfer", amount: 50_000n, accountId: cashId, toAccountId: bcaId, occurredAt: at }, testDb),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
    const t = await createTransaction(h.rizz, { kind: "expense", amount: 30_000n, accountId: cashId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    // saldo tanpa transaksi ini 40.000, jadi 40.000 lolos dan 40.001 ditolak
    const ok = await updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 40_000n } }, testDb);
    await expect(updateTransaction(h.rizz, { id: t.id, version: ok.version, patch: { amount: 40_001n } }, testDb)).rejects.toThrow(
      "Saldo Tunai tinggal Rp 40.000.",
    );
  });

  it("validasi bentuk transaksi", async () => {
    await expect(createTransaction(h.rizz, { kind: "expense", amount: "0", accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at }, testDb)).rejects.toThrow(
      "Isi nominal, misalnya 25rb",
    );
    await expect(createTransaction(h.rizz, { kind: "expense", amount: 1n, accountId: bcaId, occurredAt: at }, testDb)).rejects.toBeInstanceOf(ValidationError);
    const parsed = await createTransaction(h.rizz, { kind: "expense", amount: "25rb", accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    expect(parsed.amount).toBe(25_000n);
  });
});

describe("audit", () => {
  it("insert, update, delete, restore masing-masing menulis audit_log dengan diff benar", async () => {
    const t = await createTransaction(
      h.rizz,
      { kind: "expense", amount: 185_000n, accountId: bcaId, categoryId: cats.groceries.id, occurredAt: at, note: "pasar", tagNames: ["dapur"] },
      testDb,
    );
    const updated = await updateTransaction(h.rizz, { id: t.id, version: t.version, patch: { amount: 158_000n, note: "pasar pagi", tagNames: ["dapur", "mingguan"] } }, testDb);
    expect(updated.version).toBe(2);
    const deleted = await deleteTransaction(h.rizz, { id: t.id, version: 2 }, testDb);
    await restoreTransaction(h.rizz, { id: t.id }, testDb, new Date(deleted.deletedAt!.getTime() + 1000));

    const log = await auditFor(t.id);
    expect(log.map((l) => l.action)).toEqual(["insert", "update", "delete", "restore"]);
    expect(log[0]!.diff).toMatchObject({ amount: [null, "185000"], note: [null, "pasar"], tags: [[], ["dapur"]] });
    expect(log[1]!.diff).toEqual({ amount: ["185000", "158000"], note: ["pasar", "pasar pagi"], tags: [["dapur"], ["dapur", "mingguan"]] });
    expect(Object.keys(log[2]!.diff as object)).toEqual(["deleted_at"]);
    expect((log[3]!.diff as Record<string, unknown[]>).deleted_at![1]).toBeNull();

    const detail = await getTransaction(h.rizz, t.id, testDb);
    expect(detail.history).toHaveLength(4);
    expect(detail.history[0]!.action).toBe("restore");
    expect(detail.tags.map((x) => x.name)).toEqual(["dapur", "mingguan"]);
  });

  it("edit satu field tidak mereset field lain ke default", async () => {
    const t = await createTransaction(
      h.rizz,
      { kind: "expense", amount: 10_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at, beneficiary: "shared", source: "quick_add" },
      testDb,
    );
    const u = await updateTransaction(h.rizz, { id: t.id, version: 1, patch: { note: "kopi" } }, testDb);
    expect(u).toMatchObject({ beneficiary: "shared", source: "quick_add", note: "kopi" });
    expect((await auditFor(t.id))[1]!.diff).toEqual({ note: [null, "kopi"] });
  });

  it("transaksi terhapus masuk Baru dihapus dan tidak terhitung di daftar biasa", async () => {
    const t = await createTransaction(h.rizz, { kind: "expense", amount: 10_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    await deleteTransaction(h.rizz, { id: t.id, version: 1 }, testDb);
    expect((await listTransactions(h.rizz, { scope: "me" }, {}, testDb)).rows).toHaveLength(0);
    expect((await listTransactions(h.rizz, { scope: "me", deleted: true }, {}, testDb)).rows.map((r) => r.id)).toEqual([t.id]);
    await expect(restoreTransaction(h.rizz, { id: t.id }, testDb, new Date(Date.now() + 31 * 86_400_000))).rejects.toThrow("lebih dari 30 hari");
  });

  it("mengubah transaksi milik partner mengirim notifikasi dengan ringkasan sebelum dan sesudah", async () => {
    const t = await createTransaction(h.nadia, { kind: "expense", amount: 185_000n, accountId: nadiaCashId, categoryId: cats.groceries.id, occurredAt: at }, testDb);
    await createTransaction(h.rizz, { kind: "expense", amount: 1_000n, accountId: nadiaCashId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    expect(await testDb.select().from(notifications)).toHaveLength(0);

    const edited = await updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 158_000n } }, testDb);
    expect(edited.updatedBy).toBe(h.rizz.user.id);
    const list = await testDb.select().from(notifications);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ recipientId: h.nadia.user.id, kind: "partner_edit" });
    expect(list[0]!.payload).toMatchObject({
      actorName: "Rizz",
      label: "Belanja dapur",
      changes: [{ field: "amount", before: "185000", after: "158000" }],
      message: "Rizz mengubah Belanja dapur 12 Sep: Rp 185.000 menjadi Rp 158.000.",
    });

    // Nadia mengubah miliknya sendiri: tidak ada notifikasi baru
    await updateTransaction(h.nadia, { id: t.id, version: 2, patch: { note: "pasar" } }, testDb);
    expect(await testDb.select().from(notifications)).toHaveLength(1);
  });
});

describe("konflik edit", () => {
  it("dua update dengan versi sama: yang kedua ditolak dengan versi terbaru dan nama pengubah", async () => {
    const t = await createTransaction(h.rizz, { kind: "expense", amount: 100_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    await updateTransaction(h.nadia, { id: t.id, version: 1, patch: { amount: 120_000n } }, testDb);
    const second = updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 90_000n } }, testDb);
    await expect(second).rejects.toBeInstanceOf(ConflictError);
    const err = (await second.catch((e: unknown) => e)) as ConflictError<{ amount: bigint; version: number }>;
    expect(err.latest.amount).toBe(120_000n);
    expect(err.latest.version).toBe(2);
    expect(err.updatedByName).toBe("Nadia");
    expect(err.message).toMatch(/^Transaksi ini baru diubah Nadia pukul \d{2}\.\d{2}\. Pilih versi yang dipakai\.$/);
    expect((await auditFor(t.id)).filter((l) => l.action === "update")).toHaveLength(1);
  });

  it("dua update paralel dengan versi sama: tepat satu yang berhasil", async () => {
    const t = await createTransaction(h.rizz, { kind: "expense", amount: 100_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at }, testDb);
    const results = await Promise.allSettled([
      updateTransaction(h.rizz, { id: t.id, version: 1, patch: { amount: 1n } }, testDb),
      updateTransaction(h.nadia, { id: t.id, version: 1, patch: { amount: 2n } }, testDb),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });

  it("client_id idempoten untuk antrean offline", async () => {
    const input = { kind: "expense" as const, amount: 10_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: at, clientId: "offline-12345678" };
    const a = await createTransaction(h.rizz, input, testDb);
    const b = await createTransaction(h.rizz, input, testDb);
    expect(b.id).toBe(a.id);
  });
});
