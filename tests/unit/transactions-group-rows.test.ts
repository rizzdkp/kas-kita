import { describe, expect, it } from "vitest";
import { groupByDay, HEADER_HEIGHT, insertRows, itemSizes, ROW_HEIGHT, type ListItem } from "@/components/transactions/group-rows";
import type { TransactionListRow } from "@/server/queries/transactions";

/** Waktu WIB (UTC+7) sebagai Date, tanpa bergantung pada TZ proses tes. */
function wib(local: string): Date {
  return new Date(`${local}+07:00`);
}

function row(id: string, occurredAt: Date, flow: TransactionListRow["flow"], amount: bigint): TransactionListRow {
  const kind = flow === "income" || flow === "expense" ? flow : "transfer";
  return {
    id,
    kind,
    flow,
    amount,
    occurredAt,
    note: null,
    beneficiary: "owner",
    status: "confirmed",
    source: "manual",
    accountId: "acc",
    accountName: "BCA",
    ownerId: "u1",
    toAccountId: null,
    toAccountName: null,
    toOwnerId: null,
    counterpartyAccountName: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    parentCategoryName: null,
    createdBy: "u1",
    createdByName: "Rizz",
    updatedBy: "u1",
    version: 1,
    deletedAt: null,
    tags: [],
  };
}

const headers = (items: ListItem[]) =>
  items.filter((i): i is Extract<ListItem, { type: "header" }> => i.type === "header").map((h) => [h.label, h.total]);

// 24 Sep 2026 pukul 10.00 WIB = 03.00 UTC
const NOW = wib("2026-09-24T10:00:00");

describe("groupByDay", () => {
  const rows = [
    row("a", wib("2026-09-24T08:00:00"), "expense", 50_000n),
    // 23.30 WIB = 16.30 UTC di hari yang sama; 00.10 WIB = 17.10 UTC hari sebelumnya
    row("b", wib("2026-09-23T23:30:00"), "income", 100_000n),
    row("c", wib("2026-09-23T00:10:00"), "expense", 20_000n),
    row("d", wib("2026-09-22T23:30:00"), "transfer_out", 500_000n),
    row("e", wib("2025-12-31T23:30:00"), "expense", 10_000n),
  ];

  it("mengelompokkan per hari WIB, termasuk transaksi 23.30 dan 00.10 WIB", () => {
    const items = groupByDay(rows, false, NOW);
    expect(items.map((i) => (i.type === "header" ? i.key : i.row.id))).toEqual([
      "h-2026-09-24",
      "a",
      "h-2026-09-23",
      "b",
      "c",
      "h-2026-09-22",
      "d",
      "h-2025-12-31",
      "e",
    ]);
  });

  it("label relatif, tahun hanya untuk tahun lain, total bersih tanpa transfer", () => {
    expect(headers(groupByDay(rows, false, NOW))).toEqual([
      ["Hari ini", -50_000n],
      ["Kemarin", 80_000n],
      ["22 Sep", 0n],
      ["31 Des 2025", -10_000n],
    ]);
  });

  it("hari ini dihitung di WIB walau UTC masih kemarin", () => {
    // 24 Sep 00.30 WIB = 23 Sep 17.30 UTC
    const items = groupByDay([row("x", wib("2026-09-24T00:05:00"), "income", 1n)], false, wib("2026-09-24T00:30:00"));
    expect(headers(items)).toEqual([["Hari ini", 1n]]);
  });

  it("total hari terakhir disembunyikan selama masih ada halaman berikutnya", () => {
    const h = headers(groupByDay(rows, true, NOW));
    expect(h.at(-1)).toEqual(["31 Des 2025", null]);
    expect(h[0]).toEqual(["Hari ini", -50_000n]);
  });

  it("daftar kosong tidak menghasilkan header", () => {
    expect(groupByDay([], false, NOW)).toEqual([]);
  });

  it("tinggi item mengikuti jenisnya", () => {
    expect(itemSizes(groupByDay(rows.slice(0, 1), false, NOW))).toEqual([HEADER_HEIGHT, ROW_HEIGHT]);
  });
});

describe("insertRows", () => {
  const loaded = [row("b", wib("2026-09-23T12:00:00"), "expense", 1n), row("a", wib("2026-09-22T12:00:00"), "expense", 1n)];

  it("menyisipkan baris baru sesuai urutan terbaru dulu", () => {
    const extra = new Map([["n", row("n", wib("2026-09-24T12:00:00"), "income", 1n)]]);
    expect(insertRows(loaded, extra, false).map((r) => r.id)).toEqual(["n", "b", "a"]);
  });

  it("baris lebih lama dari halaman yang dimuat ditunda bila masih ada halaman berikutnya", () => {
    const extra = new Map([["o", row("o", wib("2026-09-01T12:00:00"), "income", 1n)]]);
    expect(insertRows(loaded, extra, true).map((r) => r.id)).toEqual(["b", "a"]);
    expect(insertRows(loaded, extra, false).map((r) => r.id)).toEqual(["b", "a", "o"]);
  });
});
