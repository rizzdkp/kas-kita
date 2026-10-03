import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { auditLog, transactions, transactionSplits } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { createAttachment } from "@/server/mutations/attachments";
import { saveReceiptTransaction } from "@/server/mutations/receipts";
import { SPLIT_EDIT_MESSAGES, updateTransaction, type TransactionRow } from "@/server/mutations/transactions";
import { uuidv7 } from "@/lib/uuid";

let h: Household;
let cats: Awaited<ReturnType<typeof seedBasicCategories>>;
let bcaId: string;
let saved: TransactionRow;

const at = new Date("2026-09-20T19:42:00+07:00");

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  cats = await seedBasicCategories(testDb);
  bcaId = (await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 1_000_000n })).id;
  const attachmentId = uuidv7();
  await createAttachment(h.rizz, { id: attachmentId, storageKey: `2026/09/${attachmentId}.jpg`, mime: "image/jpeg", sizeBytes: 1000, sha256: "a".repeat(64) }, testDb);
  // dapur 120.000 + jajan 48.000 = 168.000
  const result = await saveReceiptTransaction(
    h.rizz,
    {
      attachmentId,
      clientId: `struk-${attachmentId}`,
      mode: "split",
      amount: 168_000n,
      accountId: bcaId,
      occurredAt: at,
      note: "Indomaret",
      beneficiary: "shared",
      items: [
        { name: "Beras", amount: 120_000n, categoryId: cats.groceries.id },
        { name: "Chitato", amount: 48_000n, categoryId: cats.coffee.id },
      ],
    },
    testDb,
  );
  saved = result.transaction;
});

afterAll(closeDb);

async function splitsOf(id: string) {
  const rows = await testDb.select().from(transactionSplits).where(eq(transactionSplits.transactionId, id));
  return rows.map((s) => [s.categoryId, s.amount]).sort();
}

async function updateAudits(id: string) {
  return testDb
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, "transactions"), eq(auditLog.entityId, id), eq(auditLog.action, "update")));
}

describe("ubah transaksi yang dipecah per kategori", () => {
  it("menolak ganti nominal dengan pesan COPY.md di field nominal; transaksi, split, dan audit tidak berubah", async () => {
    const before = await splitsOf(saved.id);
    const error = await updateTransaction(h.rizz, { id: saved.id, version: saved.version, patch: { amount: 170_000n } }, testDb).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toBe(SPLIT_EDIT_MESSAGES.amount);
    expect((error as ValidationError).fieldErrors).toEqual({ amount: [SPLIT_EDIT_MESSAGES.amount] });

    const [row] = await testDb.select().from(transactions).where(eq(transactions.id, saved.id));
    expect(row).toMatchObject({ amount: 168_000n, version: saved.version });
    expect(await splitsOf(saved.id)).toEqual(before);
    expect(await updateAudits(saved.id)).toHaveLength(0);
  });

  it("menolak ganti jenis, karena split memakai kategori pengeluaran", async () => {
    await expect(
      updateTransaction(h.rizz, { id: saved.id, version: saved.version, patch: { kind: "income", categoryId: cats.salary.id } }, testDb),
    ).rejects.toThrow(SPLIT_EDIT_MESSAGES.kind);
  });

  it("edit lain tetap bisa, termasuk mengirim nominal yang sama; split tidak tersentuh", async () => {
    const before = await splitsOf(saved.id);
    const updated = await updateTransaction(
      h.rizz,
      { id: saved.id, version: saved.version, patch: { amount: 168_000n, note: "Indomaret Kemang", categoryId: cats.coffee.id } },
      testDb,
    );

    expect(updated).toMatchObject({ amount: 168_000n, note: "Indomaret Kemang", categoryId: cats.coffee.id, version: saved.version + 1 });
    expect(await splitsOf(saved.id)).toEqual(before);
    const audits = await updateAudits(saved.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.diff).not.toHaveProperty("amount");
  });
});
