import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { attachments, auditLog, transactions, transactionSplits } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { createAttachment } from "@/server/mutations/attachments";
import { saveReceiptTransaction, SPLIT_MESSAGES } from "@/server/mutations/receipts";
import { uuidv7 } from "@/lib/uuid";

let h: Household;
let cats: Awaited<ReturnType<typeof seedBasicCategories>>;
let bcaId: string;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  cats = await seedBasicCategories(testDb);
  bcaId = (await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 1_000_000n })).id;
});

afterAll(closeDb);

async function previewAttachment(): Promise<string> {
  const id = uuidv7();
  await createAttachment(h.rizz, { id, storageKey: `2026/09/${id}.jpg`, mime: "image/jpeg", sizeBytes: 1000, sha256: "a".repeat(64) }, testDb);
  return id;
}

const at = new Date("2026-09-20T19:42:00+07:00");

function splitInput(attachmentId: string) {
  return {
    attachmentId,
    clientId: `struk-${attachmentId}`,
    mode: "split" as const,
    amount: 168_000n,
    accountId: bcaId,
    occurredAt: at,
    note: "Indomaret",
    beneficiary: "shared" as const,
    items: [
      { name: "Beras", amount: 72_900n, categoryId: cats.groceries.id },
      { name: "Aqua", amount: 9_000n, categoryId: cats.coffee.id },
      { name: "Telur", amount: 44_000n, categoryId: cats.groceries.id },
      { name: "Hemat", amount: -1_600n, categoryId: cats.groceries.id },
      { name: "Chitato", amount: 43_700n, categoryId: cats.coffee.id },
    ],
  };
}

describe("simpan struk dipecah per kategori", () => {
  it("satu transaksi, split per kategori dengan jumlah = nominal, lampiran tertaut, semua ter-audit", async () => {
    const attachmentId = await previewAttachment();
    const saved = await saveReceiptTransaction(h.rizz, splitInput(attachmentId), testDb);

    expect(saved.transaction).toMatchObject({ kind: "expense", amount: 168_000n, source: "receipt", note: "Indomaret", beneficiary: "shared" });
    // dapur 72.900 + 44.000 − 1.600 = 115.300 lebih besar dari jajan 9.000 + 43.700 = 52.700
    expect(saved.transaction.categoryId).toBe(cats.groceries.id);
    const splits = await testDb.select().from(transactionSplits).where(eq(transactionSplits.transactionId, saved.transaction.id));
    expect(splits.map((s) => [s.categoryId, s.amount]).sort()).toEqual(
      [
        [cats.groceries.id, 115_300n],
        [cats.coffee.id, 52_700n],
      ].sort(),
    );
    expect(splits.find((s) => s.categoryId === cats.coffee.id)?.note).toBe("Aqua, Chitato");

    const [att] = await testDb.select().from(attachments).where(eq(attachments.id, attachmentId));
    expect(att!.transactionId).toBe(saved.transaction.id);
    expect(att!.version).toBe(2);

    const audits = await testDb.select().from(auditLog);
    const byEntity = (e: string) => audits.filter((a) => a.entity === e);
    expect(byEntity("transactions").map((a) => a.action)).toEqual(["insert"]);
    expect(byEntity("transaction_splits")).toHaveLength(2);
    expect(byEntity("transaction_splits")[0]!.diff).toMatchObject({ transaction_id: [null, saved.transaction.id] });
    const attachmentAudit = byEntity("attachments").find((a) => a.action === "update");
    expect(attachmentAudit!.diff).toEqual({ transaction_id: [null, saved.transaction.id] });
  });

  it("kiriman ulang dengan clientId sama tidak membuat transaksi atau split baru", async () => {
    const attachmentId = await previewAttachment();
    const first = await saveReceiptTransaction(h.rizz, splitInput(attachmentId), testDb);
    const second = await saveReceiptTransaction(h.rizz, splitInput(attachmentId), testDb);
    expect(second.transaction.id).toBe(first.transaction.id);
    const rows = (await testDb.execute(sql`select count(*)::int as n from transaction_splits`)) as unknown as Array<{ n: number }>;
    expect(rows[0]?.n).toBe(2);
  });

  it("jumlah item tidak sama dengan total ditolak sebelum menulis apa pun", async () => {
    const attachmentId = await previewAttachment();
    const input = { ...splitInput(attachmentId), amount: 170_000n };
    await expect(saveReceiptTransaction(h.rizz, input, testDb)).rejects.toThrow(SPLIT_MESSAGES.mismatch(168_000n, 170_000n));
    expect(await testDb.select().from(transactions)).toHaveLength(0);
  });

  it("item tanpa kategori ditolak", async () => {
    const attachmentId = await previewAttachment();
    const input = splitInput(attachmentId);
    input.items[0] = { ...input.items[0]!, categoryId: null as unknown as string };
    await expect(saveReceiptTransaction(h.rizz, input, testDb)).rejects.toBeInstanceOf(ValidationError);
  });

  it("trigger deferred menolak split yang tidak sama dengan nominal", async () => {
    const attachmentId = await previewAttachment();
    const saved = await saveReceiptTransaction(h.rizz, splitInput(attachmentId), testDb);
    await expect(
      testDb.transaction(async (tx) => {
        await tx.update(transactionSplits).set({ amount: 1n }).where(and(eq(transactionSplits.transactionId, saved.transaction.id), eq(transactionSplits.categoryId, cats.coffee.id)));
      }),
    ).rejects.toThrow();
  });
});

describe("simpan struk sebagai satu transaksi", () => {
  it("tanpa split, kategori pilihan, lampiran tertaut", async () => {
    const attachmentId = await previewAttachment();
    const saved = await saveReceiptTransaction(
      h.rizz,
      { ...splitInput(attachmentId), mode: "single", categoryId: cats.food.id, amount: 170_000n },
      testDb,
    );
    expect(saved.transaction.categoryId).toBe(cats.food.id);
    expect(saved.splits).toHaveLength(0);
    const [att] = await testDb.select().from(attachments).where(eq(attachments.id, attachmentId));
    expect(att!.transactionId).toBe(saved.transaction.id);
  });

  it("lampiran yang sudah tertaut ke transaksi lain ditolak", async () => {
    const attachmentId = await previewAttachment();
    await saveReceiptTransaction(h.rizz, { ...splitInput(attachmentId), mode: "single", categoryId: cats.food.id }, testDb);
    await expect(
      saveReceiptTransaction(h.rizz, { ...splitInput(attachmentId), clientId: "struk-lain-123", mode: "single", categoryId: cats.food.id }, testDb),
    ).rejects.toThrow("Foto struk ini sudah tersimpan di transaksi lain.");
    expect(await testDb.select().from(transactions)).toHaveLength(1);
  });
});
