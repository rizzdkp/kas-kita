import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createAccountRow, createCategoryRow, createHousehold, insertTx, seedBasicCategories, type Household } from "../helpers/fixtures";
import { splitDetailText, transactionCsvRow } from "@/app/api/export/_lib/csv";
import { serializeMoney } from "@/lib/money";
import { budgets, notifications, transactionSplits, transactions } from "@/server/db/schema";
import { collectWeeklyFacts } from "@/server/insights/collect";
import { upsertBudget } from "@/server/mutations/budgets";
import { sumFlows } from "@/server/queries/aggregates";
import { listSplitsForTransactions } from "@/server/queries/attachments";
import { listBudgets } from "@/server/queries/budgets";
import { getDashboard } from "@/server/queries/dashboard";
import { getMonthEndForecast } from "@/server/queries/forecast";
import { getMonthlyReport } from "@/server/queries/reports";
import { categoryLines } from "@/server/queries/scope";
import { listTransactions } from "@/server/queries/transactions";
import { handleDueNotificationsJob } from "@/worker/jobs/due-notifications";

/**
 * Keputusan 0015: transaksi yang dipecah dihitung per kategori split di semua agregasi.
 * Hari ini Kamis 24 Sep 2026 10.00 WIB.
 * BCA Rizz saldo awal 10.000.000 (1 Agu); Mandiri Nadia saldo awal 3.000.000 (1 Agu).
 *   24 Agu Rizz gaji +8.000.000 (transaksi pertama Rizz: 31 hari data sampai kemarin)
 *   10 Sep Rizz Transportasi −50.000
 *   15 Sep Nadia Kesehatan −30.000
 *   20 Sep Rizz struk Indomaret −168.000, kategori utama Belanja dapur, dipecah:
 *          Belanja dapur 120.000 + Kesehatan 48.000 = 168.000
 * Anggaran September Rizz: Kesehatan 50.000 wajib, Makan dan minum 1.000.000 fleksibel.
 */
let h: Household;
let c: Awaited<ReturnType<typeof seedBasicCategories>>;
let health: { id: string };
let receiptId: string;
let transportId: string;
let nadiaHealthId: string;
const now = new Date("2026-09-24T10:00:00+07:00");
const today = "2026-09-24";

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  c = await seedBasicCategories(testDb);
  health = await createCategoryRow(testDb, { name: "Kesehatan", kind: "expense" });
  const rizz = h.rizz.user.id;
  const nadia = h.nadia.user.id;
  const bca = await createAccountRow(testDb, { name: "BCA", type: "bank", ownerId: rizz, openingBalance: 10_000_000n, openingDate: "2026-08-01" });
  const mandiri = await createAccountRow(testDb, { name: "Mandiri", type: "bank", ownerId: nadia, openingBalance: 3_000_000n, openingDate: "2026-08-01" });
  await insertTx(testDb, { kind: "income", amount: 8_000_000n, accountId: bca.id, categoryId: c.salary.id, occurredAt: "2026-08-24T08:00:00+07:00", createdBy: rizz });
  transportId = (await insertTx(testDb, { kind: "expense", amount: 50_000n, accountId: bca.id, categoryId: c.transport.id, occurredAt: "2026-09-10T08:00:00+07:00", createdBy: rizz })).id;
  nadiaHealthId = (await insertTx(testDb, { kind: "expense", amount: 30_000n, accountId: mandiri.id, categoryId: health.id, occurredAt: "2026-09-15T08:00:00+07:00", createdBy: nadia })).id;
  receiptId = (
    await insertTx(testDb, { kind: "expense", amount: 168_000n, accountId: bca.id, categoryId: c.groceries.id, occurredAt: "2026-09-20T19:42:00+07:00", createdBy: rizz, note: "Indomaret" })
  ).id;
  // satu statement supaya trigger deferred jumlah split melihat kedua baris sekaligus
  await testDb.insert(transactionSplits).values([
    { transactionId: receiptId, categoryId: c.groceries.id, amount: 120_000n },
    { transactionId: receiptId, categoryId: health.id, amount: 48_000n },
  ]);
  await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: health.id, month: "2026-09-01", amount: 50_000n, isMandatory: true }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: `user:${rizz}`, categoryId: c.food.id, month: "2026-09-01", amount: 1_000_000n }, testDb);
});

afterAll(closeDb);

describe("baris kategori", () => {
  it("jumlah baris per transaksi sama dengan nominal transaksinya", async () => {
    const lines = await testDb
      .select({ id: categoryLines.transactionId, total: sql<bigint>`sum(${categoryLines.amount})::bigint`, n: sql<number>`count(*)::int` })
      .from(categoryLines)
      .groupBy(categoryLines.transactionId);
    const amounts = new Map((await testDb.select({ id: transactions.id, amount: transactions.amount }).from(transactions)).map((t) => [t.id, t.amount]));
    // 4 transaksi dihitung: gaji, transportasi, kesehatan Nadia, struk (2 baris)
    expect(lines).toHaveLength(4);
    for (const l of lines) expect(BigInt(l.total)).toBe(amounts.get(l.id));
    expect(lines.find((l) => l.id === receiptId)?.n).toBe(2);
  });

  it("total baris per jenis sama dengan pemasukan dan pengeluaran periode", async () => {
    const range = { start: new Date("2026-08-01T00:00:00+07:00"), end: new Date("2026-10-01T00:00:00+07:00") };
    const flows = await sumFlows(h.rizz, "all", range, testDb);
    const byKind = await testDb
      .select({ kind: categoryLines.kind, total: sql<bigint>`sum(${categoryLines.amount})::bigint` })
      .from(categoryLines)
      .groupBy(categoryLines.kind);
    // pengeluaran 50.000 + 30.000 + 168.000 = 248.000; pemasukan 8.000.000
    expect(flows.expense).toBe(248_000n);
    expect(flows.income).toBe(8_000_000n);
    expect(BigInt(byKind.find((k) => k.kind === "expense")!.total)).toBe(flows.expense);
    expect(BigInt(byKind.find((k) => k.kind === "income")!.total)).toBe(flows.income);
  });
});

describe("Ringkasan", () => {
  it("Saya: kategori per split, total pengeluaran tetap, sisa anggaran wajib dari bagian Kesehatan", async () => {
    const d = await getDashboard(h.rizz, "me", now, testDb);
    // pengeluaran September Rizz = 50.000 + 168.000 = 218.000 (tidak berubah oleh split)
    expect(d.expense.value).toBe(218_000n);
    // Makan dan minum 120.000 (Belanja dapur), Transportasi 50.000, Kesehatan 48.000; jumlah 218.000
    expect(d.categories.value.map((g) => [g.name, g.total])).toEqual([
      ["Makan dan minum", 120_000n],
      ["Transportasi", 50_000n],
      ["Kesehatan", 48_000n],
    ]);
    // sisa anggaran wajib Kesehatan = 50.000 − 48.000 = 2.000
    expect(d.safeToSpend.components.mandatoryRemaining).toBe(2_000n);
    // saldo likuid = 10.000.000 + 8.000.000 − 50.000 − 168.000 = 17.782.000; tanpa tagihan dan target
    expect(d.safeToSpend.value).toBe(17_780_000n);
  });

  it("Gabungan: kontribusi per pemilik memakai bagian split", async () => {
    const d = await getDashboard(h.rizz, "all", now, testDb);
    expect(d.expense.value).toBe(248_000n);
    const kesehatan = d.categories.value.find((g) => g.categoryId === health.id)!;
    // Kesehatan = 48.000 (struk Rizz) + 30.000 (Nadia) = 78.000
    expect(kesehatan.total).toBe(78_000n);
    expect(kesehatan.byOwner).toEqual(
      expect.arrayContaining([
        { ownerId: h.rizz.user.id, amount: 48_000n },
        { ownerId: h.nadia.user.id, amount: 30_000n },
      ]),
    );
    const food = d.categories.value.find((g) => g.categoryId === c.food.id)!;
    expect(food.total).toBe(120_000n);
    expect(food.children).toEqual([{ categoryId: c.groceries.id, name: "Belanja dapur", total: 120_000n }]);
  });
});

describe("Anggaran dan prediksi", () => {
  it("anggaran Kesehatan terpakai 48.000 dan lajunya lebih cepat dari biasa", async () => {
    const list = await listBudgets(h.rizz, "me", { month: "2026-09-01", today }, testDb);
    const kesehatan = list.find((b) => b.categoryId === health.id)!;
    expect(kesehatan.spent).toBe(48_000n);
    // terpakai 48.000 / 50.000 = 96%, hari berlalu 24/30 = 80%, selisih 16 poin > 15
    expect(kesehatan.status.value).toMatchObject({ state: "near", usedPercent: 96, elapsedPercent: 80, fasterThanUsual: true, remaining: 2_000n });
    expect(list.find((b) => b.categoryId === c.food.id)!.spent).toBe(120_000n);
  });

  it("prediksi: bagian split di kategori wajib tidak masuk pengeluaran fleksibel", async () => {
    const f = await getMonthEndForecast(h.rizz, "me", now, testDb);
    if (!f.value.available) throw new Error("prediksi harus tersedia");
    // 31 hari data (24 Agu sampai 23 Sep); 4 minggu dari kemarin mundur:
    //   17-23 Sep 120.000 (struk tanpa bagian Kesehatan), 10-16 Sep 50.000, 3-9 Sep 0, 27 Agu-2 Sep 0
    // urut [0, 0, 50.000, 120.000]: kuartil bawah ×4 = 0; kuartil atas ×4 = 4×50.000 + 1×70.000 = 270.000
    // harian tinggi = 270.000 / 28 = 9.642,9 → 9.643; sisa hari 24→30 Sep = 6
    expect(f.value.dataDays).toBe(31);
    expect(f.value.dailyLow).toBe(0n);
    expect(f.value.dailyHigh).toBe(9_643n);
    // terpakai sampai hari ini tetap seluruh pengeluaran = 218.000
    expect(f.value.spentSoFar).toBe(218_000n);
    expect(f.value.low).toBe(218_000n);
    expect(f.value.high).toBe(218_000n + 9_643n * 6n);
  });
});

describe("Laporan dan wawasan", () => {
  it("laporan bulanan Gabungan: kategori per split, total tetap", async () => {
    const r = await getMonthlyReport(h.rizz, "all", "2026-09", today, testDb);
    expect(r.expense.value).toBe(248_000n);
    expect(r.expenseCategories.value.map((g) => [g.name, g.total])).toEqual([
      ["Makan dan minum", 120_000n],
      ["Kesehatan", 78_000n],
      ["Transportasi", 50_000n],
    ]);
    const sum = r.expenseCategories.value.reduce((s, g) => s + g.total, 0n);
    expect(sum).toBe(r.expense.value);
    expect(r.trend.value.at(-1)).toEqual({ month: "2026-09", income: 0n, expense: 248_000n });
  });

  it("wawasan minggu 14-20 Sep: kategori, laju anggaran, dan total minggu memakai bagian split", async () => {
    const facts = await collectWeeklyFacts(h.rizz, "me", { weekStart: "2026-09-14", today }, testDb);
    const byKind = new Map(facts.map((f) => [f.fact.kind, f]));
    // minggu itu: Makan dan minum 120.000 dan Kesehatan 48.000, keduanya baru; naik terbesar Makan dan minum
    expect(byKind.get("kategori_baru")?.fact).toMatchObject({ categoryId: c.food.id, current: serializeMoney(120_000n) });
    expect(byKind.get("kategori_baru")?.sourceTransactionIds).toEqual([receiptId]);
    expect(byKind.get("anggaran_cepat")?.fact).toMatchObject({ categoryId: health.id, usedPercent: 96 });
    expect(byKind.get("anggaran_cepat")?.sourceTransactionIds).toEqual([receiptId]);
    // total minggu = 120.000 + 48.000 = 168.000 dari satu transaksi (struk tidak terhitung dua kali)
    expect(byKind.get("total_minggu")?.fact).toMatchObject({ total: serializeMoney(168_000n), count: 1 });
  });

  it("anggaran wajib lewat karena bagian split memicu notifikasi", async () => {
    const [b] = await testDb.select().from(budgets).where(eq(budgets.categoryId, health.id));
    await upsertBudget(h.rizz, { scopeOwner: `user:${h.rizz.user.id}`, categoryId: health.id, month: "2026-09-01", amount: 40_000n, isMandatory: true, version: b!.version }, testDb);
    const result = await handleDueNotificationsJob({ now, db: testDb, push: false });
    expect(result.budgetOver).toBe(1);
    const [n] = await testDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientId, h.rizz.user.id), eq(notifications.kind, "budget_over")));
    // 48.000 − 40.000 = 8.000
    expect((n?.payload as { message: string }).message).toBe("Anggaran wajib Kesehatan lewat Rp 8.000 dari Rp 40.000.");
  });
});

describe("Transaksi dan CSV", () => {
  it("filter kategori Kesehatan ikut menampilkan struk yang dipecah", async () => {
    const mine = await listTransactions(h.rizz, { scope: "me", categoryIds: [health.id] }, {}, testDb, now);
    expect(mine.rows.map((r) => r.id)).toEqual([receiptId]);
    expect(mine.rows[0]).toMatchObject({ categoryName: "Belanja dapur", splitCount: 2 });
    const all = await listTransactions(h.rizz, { scope: "all", categoryIds: [health.id] }, {}, testDb, now);
    expect(all.rows.map((r) => r.id)).toEqual([receiptId, nadiaHealthId]);
    // induk Makan dan minum: struk lewat kategori utama Belanja dapur
    const food = await listTransactions(h.rizz, { scope: "me", categoryIds: [c.food.id] }, {}, testDb, now);
    expect(food.rows.map((r) => r.id)).toEqual([receiptId]);
    const transport = await listTransactions(h.rizz, { scope: "me", categoryIds: [c.transport.id] }, {}, testDb, now);
    expect(transport.rows.map((r) => [r.id, r.splitCount])).toEqual([[transportId, 0]]);
  });

  it("CSV: satu baris per transaksi dengan kolom Rincian kategori", async () => {
    const page = await listTransactions(h.rizz, { scope: "me", categoryIds: [health.id] }, {}, testDb, now);
    const splits = await listSplitsForTransactions([receiptId], testDb);
    expect(splitDetailText(splits.get(receiptId))).toBe("Makan dan minum / Belanja dapur Rp 120.000; Kesehatan Rp 48.000");
    const line = transactionCsvRow(page.rows[0]!, splits.get(receiptId));
    expect(line).toBe(
      '2026-09-20,19:42,Pengeluaran,168000,BCA,,Makan dan minum / Belanja dapur,"Makan dan minum / Belanja dapur Rp 120.000; Kesehatan Rp 48.000",Indomaret,Rizz,,Terkonfirmasi\r\n',
    );
    expect(splitDetailText(undefined)).toBeNull();
  });
});

describe("mengubah transaksi yang dipecah", () => {
  it("menolak perubahan nominal dengan pesan jelas, tetapi tetap mengizinkan ubah catatan", async () => {
    const { updateTransaction } = await import("@/server/mutations/transactions");
    const [row] = await testDb.select().from(transactions).where(eq(transactions.id, receiptId));
    await expect(updateTransaction(h.rizz, { id: receiptId, version: row!.version, patch: { amount: 170_000n } }, testDb)).rejects.toMatchObject({
      code: "split_locked",
    });
    const updated = await updateTransaction(h.rizz, { id: receiptId, version: row!.version, patch: { note: "Indomaret Kemang" } }, testDb);
    expect(updated.note).toBe("Indomaret Kemang");
    expect(updated.amount).toBe(168_000n);
  });
});
