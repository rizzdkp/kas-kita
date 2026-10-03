import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createHousehold, getTx, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { auditLog, importBatches, importRows, transactions } from "@/server/db/schema";
import { DomainError, ValidationError } from "@/server/errors";
import { createImportBatch, failImportBatch, saveParsedRows } from "@/server/import/pipeline";
import type { ParsedRow } from "@/server/import/types";
import { commitImportBatch } from "@/server/mutations/import-commit";
import { AlreadyImportedError } from "@/server/mutations/imports";
import { listTransactions } from "@/server/queries/transactions";

let h: Household;
let cats: Awaited<ReturnType<typeof seedBasicCategories>>;
let bcaId: string;
let gopayId: string;

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  cats = await seedBasicCategories(testDb);
  bcaId = (await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: h.rizz.user.id, openingBalance: 5_000_000n })).id;
  gopayId = (await createAccountRow(testDb, { name: "GoPay", type: "ewallet", ownerId: h.rizz.user.id, openingBalance: 100_000n })).id;
});

afterAll(closeDb);

function parsed(date: string, description: string, amount: bigint, raw: Record<string, string> = {}): ParsedRow {
  return { date, time: null, description, amount, balance: null, raw: { Tanggal: date, Keterangan: description, ...raw } };
}

const statement: ParsedRow[] = [
  parsed("2026-09-10", "QRIS KOPI KENANGAN 0012345678", -54_000n),
  parsed("2026-09-12", "TRSF E-BANKING CR GAJI", 8_500_000n),
  parsed("2026-09-13", "INDOMARET CIPUTAT", -120_000n),
  parsed("2026-09-14", "PARKIR", -5_000n),
  parsed("2026-09-14", "PARKIR", -5_000n),
];

async function stage(rows: ParsedRow[], sha = SHA_A, accountId = bcaId) {
  const { id } = await createImportBatch(h.rizz, { accountId, institutionId: null, format: "csv", fileSha256: sha }, testDb);
  await saveParsedRows(h.rizz, id, rows, testDb);
  const stored = await testDb.select().from(importRows).where(eq(importRows.batchId, id)).orderBy(importRows.createdAt, importRows.id);
  return { id, rows: stored.sort((a, b) => (a.parsed as { index: number }).index - (b.parsed as { index: number }).index) };
}

function groupOf(row: { parsed: unknown }): string {
  return (row.parsed as { group: string }).group;
}

describe("saveParsedRows", () => {
  it("menyimpan baris, menghitung hash, dan menandai Kemungkinan duplikat dari transaksi manual", async () => {
    // manual 2 hari sebelum baris Indomaret (selisih 2 = masih kandidat), dan satu 3 hari sebelum kopi (bukan kandidat)
    const manual = await insertTx(testDb, { kind: "expense", amount: 120_000n, accountId: bcaId, categoryId: cats.groceries.id, occurredAt: "2026-09-11T19:00:00+07:00", createdBy: h.rizz.user.id });
    await insertTx(testDb, { kind: "expense", amount: 54_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: "2026-09-07T08:00:00+07:00", createdBy: h.rizz.user.id });
    const { id, rows } = await stage(statement);

    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, id));
    expect(batch!.status).toBe("review");
    expect(rows).toHaveLength(5);
    expect(rows.map(groupOf)).toEqual(["new", "new", "possible_duplicate", "new", "new"]);
    expect(rows[2]!.matchedTransactionId).toBe(manual.id);
    expect(rows[3]!.rowHash).not.toBe(rows[4]!.rowHash);
    expect(rows[0]!.parsed).toMatchObject({ amount: "-54000", normalizedDescription: "qris kopi kenangan", description: "QRIS KOPI KENANGAN 0012345678" });
    expect(rows[0]!.raw).toEqual({ Tanggal: "2026-09-10", Keterangan: "QRIS KOPI KENANGAN 0012345678" });
  });

  it("transfer manual ke akun impor menjadi pembanding uang masuk", async () => {
    const t = await insertTx(testDb, { kind: "transfer", amount: 100_000n, accountId: gopayId, toAccountId: bcaId, occurredAt: "2026-09-10T10:00:00+07:00", createdBy: h.rizz.user.id });
    const { rows } = await stage([parsed("2026-09-10", "SETORAN DARI GOPAY", 100_000n)]);
    expect(rows[0]!.matchedTransactionId).toBe(t.id);
  });
});

describe("file yang sama", () => {
  it("ditolak setelah committed dengan pesan COPY", async () => {
    const { id } = await stage(statement);
    await commitImportBatch(h.rizz, { batchId: id, rows: [] }, testDb);
    const err = await createImportBatch(h.rizz, { accountId: bcaId, institutionId: null, format: "csv", fileSha256: SHA_A }, testDb).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlreadyImportedError);
    expect((err as DomainError).code).toBe("already_imported");
    expect((err as DomainError).message).toMatch(/^File ini sudah diimpor pada \d{1,2} \w{3} \d{4}\. Lihat hasil impornya\.$/);
    expect((err as AlreadyImportedError).batchId).toBe(id);
  });

  it("boleh diunggah ulang bila batch lama gagal atau belum disimpan", async () => {
    const first = await createImportBatch(h.rizz, { accountId: bcaId, institutionId: null, format: "csv", fileSha256: SHA_A }, testDb);
    await failImportBatch(h.rizz, first.id, "Format file tidak dikenali.", testDb);
    const [failed] = await testDb.select().from(importBatches).where(eq(importBatches.id, first.id));
    expect(failed).toMatchObject({ status: "failed", error: "Format file tidak dikenali." });
    const second = await stage(statement);
    const third = await stage(statement);
    const remaining = await testDb.select({ id: importBatches.id }).from(importBatches);
    expect(remaining.map((r) => r.id)).toEqual([third.id]);
    expect(second.id).not.toBe(third.id);
  });
});

describe("commitImportBatch", () => {
  it("membuat transaksi dengan audit, source impor, dan import_row_id; baris tak dicentang jadi skip", async () => {
    const { id, rows } = await stage(statement);
    const result = await commitImportBatch(
      h.rizz,
      {
        batchId: id,
        rows: [
          { rowId: rows[0]!.id, action: "import", categoryId: cats.coffee.id },
          { rowId: rows[1]!.id, action: "import", categoryId: cats.salary.id, beneficiary: "shared" },
          { rowId: rows[2]!.id, action: "skip" },
        ],
      },
      testDb,
    );
    expect(result).toEqual({ batchId: id, created: 2, linked: 0, skipped: 3 });

    const created = await testDb.select().from(transactions).orderBy(transactions.occurredAt);
    expect(created.map((t) => [t.kind, t.amount, t.source, t.importRowId, t.note])).toEqual([
      ["expense", 54_000n, "import_csv", rows[0]!.id, "QRIS KOPI KENANGAN 0012345678"],
      ["income", 8_500_000n, "import_csv", rows[1]!.id, "TRSF E-BANKING CR GAJI"],
    ]);
    expect(created[0]!.occurredAt.toISOString()).toBe("2026-09-10T05:00:00.000Z");
    expect(created[1]!.beneficiary).toBe("shared");

    const audits = await testDb.select().from(auditLog).where(eq(auditLog.entity, "transactions"));
    expect(audits).toHaveLength(2);
    expect(audits.every((a) => a.action === "insert" && a.actorId === h.rizz.user.id)).toBe(true);
    const diff = audits.find((a) => a.entityId === created[0]!.id)!.diff as Record<string, [unknown, unknown]>;
    expect(diff.amount).toEqual([null, "54000"]);
    expect(diff.import_row_id).toEqual([null, rows[0]!.id]);
    expect(diff.source).toEqual([null, "import_csv"]);

    const after = await testDb.select().from(importRows).where(eq(importRows.batchId, id));
    expect(after.filter((r) => r.decision === "skip")).toHaveLength(3);
    expect(after.every((r) => r.committedAt !== null)).toBe(true);
    const [batch] = await testDb.select().from(importBatches).where(eq(importBatches.id, id));
    expect(batch!.status).toBe("committed");
  });

  it("kategori wajib untuk baris yang dicentang", async () => {
    const { id, rows } = await stage(statement);
    const err = await commitImportBatch(h.rizz, { batchId: id, rows: [{ rowId: rows[0]!.id, action: "import", categoryId: null }] }, testDb).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).fieldErrors).toEqual({ [`rows.${rows[0]!.id}.categoryId`]: ["Pilih kategori"] });
    expect(await testDb.select().from(transactions)).toHaveLength(0);
  });

  it("Sama, tautkan: menautkan transaksi manual tanpa membuat transaksi baru", async () => {
    const manual = await insertTx(testDb, { kind: "expense", amount: 120_000n, accountId: bcaId, categoryId: cats.groceries.id, occurredAt: "2026-09-13T19:00:00+07:00", createdBy: h.rizz.user.id });
    const { id, rows } = await stage(statement);
    expect(rows[2]!.matchedTransactionId).toBe(manual.id);
    const result = await commitImportBatch(h.rizz, { batchId: id, rows: [{ rowId: rows[2]!.id, action: "link" }] }, testDb);
    expect(result).toMatchObject({ created: 0, linked: 1 });
    expect(await testDb.select().from(transactions)).toHaveLength(1);
    const linked = await getTx(testDb, manual.id);
    expect(linked.importRowId).toBe(rows[2]!.id);
    expect(linked.version).toBe(2);
    const [row] = await testDb.select().from(importRows).where(eq(importRows.id, rows[2]!.id));
    expect(row).toMatchObject({ decision: "duplicate_of", matchedTransactionId: manual.id });
    const [audit] = await testDb.select().from(auditLog).where(and(eq(auditLog.entity, "transactions"), eq(auditLog.entityId, manual.id)));
    expect(audit!.diff).toEqual({ import_row_id: [null, rows[2]!.id] });
  });

  it("Beda, impor sebagai baru: kemungkinan duplikat diimpor sebagai transaksi baru", async () => {
    await insertTx(testDb, { kind: "expense", amount: 120_000n, accountId: bcaId, categoryId: cats.groceries.id, occurredAt: "2026-09-13T19:00:00+07:00", createdBy: h.rizz.user.id });
    const { id, rows } = await stage(statement);
    await commitImportBatch(h.rizz, { batchId: id, rows: [{ rowId: rows[2]!.id, action: "import", categoryId: cats.groceries.id }] }, testDb);
    expect(await testDb.select().from(transactions)).toHaveLength(2);
  });

  it("file berbeda dengan baris yang sudah committed: Duplikat pasti, tidak bisa diimpor ulang", async () => {
    const first = await stage(statement);
    await commitImportBatch(h.rizz, { batchId: first.id, rows: first.rows.slice(0, 4).map((r) => ({ rowId: r.id, action: "import" as const, categoryId: BigInt((r.parsed as { amount: string }).amount) > 0n ? cats.salary.id : cats.coffee.id })) }, testDb);
    // unduhan kedua: periode tumpang tindih, nomor referensi beda, satu baris baru
    const second = await stage([...statement.slice(0, 4).map((r) => ({ ...r, description: r.description.replace("0012345678", "0099999999") })), parsed("2026-09-15", "PARKIR", -5_000n)], SHA_B);
    expect(second.rows.map(groupOf)).toEqual(["exact_duplicate", "exact_duplicate", "exact_duplicate", "exact_duplicate", "new"]);
    // PARKIR kedua pada 14 Sep dilewati di batch pertama, jadi hash urutan 2 tidak committed dan baris itu tidak ada di file kedua
    const result = await commitImportBatch(h.rizz, { batchId: second.id, rows: second.rows.map((r) => ({ rowId: r.id, action: "import" as const, categoryId: cats.transport.id })) }, testDb);
    expect(result).toMatchObject({ created: 1, skipped: 4 });
  });

  it("filter batch di listTransactions memuat transaksi baru dan yang ditautkan", async () => {
    const manual = await insertTx(testDb, { kind: "expense", amount: 120_000n, accountId: bcaId, categoryId: cats.groceries.id, occurredAt: "2026-09-13T19:00:00+07:00", createdBy: h.rizz.user.id });
    await insertTx(testDb, { kind: "expense", amount: 9_000n, accountId: bcaId, categoryId: cats.coffee.id, occurredAt: "2026-09-13T19:00:00+07:00", createdBy: h.rizz.user.id });
    const { id, rows } = await stage(statement);
    await commitImportBatch(h.rizz, { batchId: id, rows: [{ rowId: rows[0]!.id, action: "import", categoryId: cats.coffee.id }, { rowId: rows[2]!.id, action: "link" }] }, testDb);
    const page = await listTransactions(h.rizz, { scope: "all", batchId: id }, {}, testDb);
    expect(page.rows.map((r) => r.amount).sort()).toEqual([120_000n, 54_000n].sort());
    expect(page.rows.some((r) => r.id === manual.id)).toBe(true);
    const all = await listTransactions(h.rizz, { scope: "all" }, {}, testDb);
    expect(all.rows).toHaveLength(3);
  });

  it("transaksi yang sudah ditautkan tidak lagi jadi pembanding", async () => {
    await insertTx(testDb, { kind: "expense", amount: 120_000n, accountId: bcaId, categoryId: cats.groceries.id, occurredAt: "2026-09-13T19:00:00+07:00", createdBy: h.rizz.user.id });
    const first = await stage(statement);
    await commitImportBatch(h.rizz, { batchId: first.id, rows: [{ rowId: first.rows[2]!.id, action: "link" }] }, testDb);
    const second = await stage([parsed("2026-09-13", "INDOMARET LAIN", -120_000n)], SHA_B);
    expect(second.rows.map(groupOf)).toEqual(["new"]);
  });

  it("batch yang sudah committed tidak bisa di-commit lagi", async () => {
    const { id } = await stage(statement);
    await commitImportBatch(h.rizz, { batchId: id, rows: [] }, testDb);
    await expect(commitImportBatch(h.rizz, { batchId: id, rows: [] }, testDb)).rejects.toMatchObject({ code: "import_committed" });
  });
});
