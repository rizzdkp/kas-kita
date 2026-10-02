import { describe, expect, it } from "vitest";
import { classifyRows, DEDUPE_WINDOW_DAYS, type DedupeCandidate, type DedupeRow } from "@/server/import/dedupe";
import { descriptionTokens, suggestCategories } from "@/server/import/category-suggest";
import { computeRowHash, computeRowHashes, normalizeDescription } from "@/server/import/row-hash";
import fixture from "../fixtures/imports/dedupe/window.json";

interface FixtureCase {
  name: string;
  row: { date: string; amount: string };
  candidate: { date: string; amount: string };
  expected: "new" | "possible_duplicate";
}

const row = (hash: string, date: string, amount: bigint): DedupeRow => ({ rowHash: hash, date, amount });
const cand = (id: string, date: string, amount: bigint): DedupeCandidate => ({ id, date, amount });

describe("jendela dedupe F-IN-6 AC1", () => {
  it("konstanta jendela 2 hari", () => {
    expect(DEDUPE_WINDOW_DAYS).toBe(2);
  });

  // fixture: selisih 0 dan 2 hari = Kemungkinan duplikat, 3 hari = Baru (dihitung manual dari tanggal di fixture)
  for (const c of (fixture as { cases: FixtureCase[] }).cases) {
    it(c.name, () => {
      const [result] = classifyRows(
        [row("h1", c.row.date, BigInt(c.row.amount))],
        new Set(),
        [cand("t1", c.candidate.date, BigInt(c.candidate.amount))],
      );
      expect(result!.group).toBe(c.expected);
      expect(result!.matchedTransactionId).toBe(c.expected === "new" ? null : "t1");
    });
  }

  it("selisih dihitung ke dua arah dan melewati batas bulan", () => {
    const results = classifyRows(
      [row("a", "2026-08-31", -50_000n), row("b", "2026-09-01", -75_000n)],
      new Set(),
      [cand("t1", "2026-09-02", -50_000n), cand("t2", "2026-08-30", -75_000n)],
    );
    expect(results.map((r) => [r.group, r.dayDiff])).toEqual([
      ["possible_duplicate", 2],
      ["possible_duplicate", 2],
    ]);
  });

  it("nominal harus sama persis termasuk arah", () => {
    const results = classifyRows([row("a", "2026-09-10", -25_000n), row("b", "2026-09-10", 25_000n)], new Set(), [
      cand("t1", "2026-09-10", 25_001n),
      cand("t2", "2026-09-10", -25_000n),
    ]);
    // baris a (keluar 25.000) cocok dengan t2 (keluar 25.000); baris b (masuk 25.000) tidak punya pasangan
    expect(results.map((r) => r.matchedTransactionId)).toEqual(["t2", null]);
  });
});

describe("pemasangan satu lawan satu", () => {
  it("satu transaksi pembanding hanya dicocokkan ke satu baris, pilih selisih terkecil", () => {
    const results = classifyRows(
      [row("a", "2026-09-08", -30_000n), row("b", "2026-09-10", -30_000n)],
      new Set(),
      [cand("t1", "2026-09-10", -30_000n)],
    );
    // a selisih 2 hari, b selisih 0 hari: t1 untuk b, a tetap Baru
    expect(results.map((r) => r.group)).toEqual(["new", "possible_duplicate"]);
    expect(results[1]!.matchedTransactionId).toBe("t1");
  });

  it("dua pembanding untuk dua baris identik dipasangkan masing-masing", () => {
    const results = classifyRows(
      [row("a", "2026-09-10", -18_000n), row("b", "2026-09-10", -18_000n)],
      new Set(),
      [cand("t1", "2026-09-10", -18_000n), cand("t2", "2026-09-11", -18_000n)],
    );
    expect(results.map((r) => r.matchedTransactionId)).toEqual(["t1", "t2"]);
  });

  it("dua baris identik di file yang sama tanpa pembanding tetap dua baris Baru", () => {
    const results = classifyRows([row("a", "2026-09-10", -18_000n), row("b", "2026-09-10", -18_000n)], new Set(), []);
    expect(results.map((r) => r.group)).toEqual(["new", "new"]);
  });
});

describe("Duplikat pasti", () => {
  it("hash yang sudah committed jadi Duplikat pasti dan tidak memakai pembanding", () => {
    const results = classifyRows(
      [row("sudah", "2026-09-10", -40_000n), row("belum", "2026-09-10", -40_000n)],
      new Set(["sudah"]),
      [cand("t1", "2026-09-10", -40_000n)],
    );
    expect(results.map((r) => r.group)).toEqual(["exact_duplicate", "possible_duplicate"]);
    expect(results[0]!.matchedTransactionId).toBeNull();
    expect(results[1]!.matchedTransactionId).toBe("t1");
  });
});

describe("normalisasi deskripsi dan row hash", () => {
  it("huruf kecil, spasi tunggal, tanpa nomor referensi panjang", () => {
    expect(normalizeDescription("  TRSF E-BANKING DB   2409/FTSCY/WS95051 \n 1234567890 KE BUDI  ")).toBe(
      "trsf e banking db 2409 ftscy ws95051 ke budi",
    );
    expect(normalizeDescription("QRIS  Indomaret 0987654321123")).toBe("qris indomaret");
    expect(normalizeDescription("Kopi Kenangan #12")).toBe("kopi kenangan 12");
  });

  it("nomor referensi berbeda menghasilkan hash yang sama", () => {
    const base = { institutionId: null, accountId: "acc", date: "2026-09-10", amount: -25_000n, occurrence: 1 };
    const a = computeRowHash({ ...base, normalizedDescription: normalizeDescription("QRIS KOPI 000111222333") });
    const b = computeRowHash({ ...base, normalizedDescription: normalizeDescription("qris kopi 999888777666") });
    expect(a).toBe(b);
  });

  it("nominal bertanda, tanggal, dan akun membedakan hash", () => {
    const base = { institutionId: null, accountId: "acc", date: "2026-09-10", normalizedDescription: "kopi", amount: -25_000n, occurrence: 1 };
    const h = computeRowHash(base);
    expect(computeRowHash({ ...base, amount: 25_000n })).not.toBe(h);
    expect(computeRowHash({ ...base, date: "2026-09-11" })).not.toBe(h);
    expect(computeRowHash({ ...base, accountId: "lain" })).not.toBe(h);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("baris identik di satu file mendapat hash berbeda tapi stabil antar unggahan", () => {
    const rows = [
      { date: "2026-09-10", normalizedDescription: "parkir", amount: -5_000n },
      { date: "2026-09-10", normalizedDescription: "parkir", amount: -5_000n },
    ];
    const first = computeRowHashes({ institutionId: null, accountId: "acc" }, rows);
    const again = computeRowHashes({ institutionId: null, accountId: "acc" }, rows);
    expect(first[0]).not.toBe(first[1]);
    expect(again).toEqual(first);
  });
});

describe("saran kategori", () => {
  const history = [
    { kind: "expense" as const, categoryId: "kopi", text: "Kopi Kenangan" },
    { kind: "expense" as const, categoryId: "kopi", text: "kopi kenangan senopati" },
    { kind: "expense" as const, categoryId: "belanja", text: "Indomaret" },
    { kind: "income" as const, categoryId: "gaji", text: "TRSF E-BANKING CR GAJI PT CONTOH" },
  ];

  it("kategori paling sering dari deskripsi mirip, jenis harus sama", () => {
    const result = suggestCategories(
      [
        { kind: "expense", description: "QRIS KOPI KENANGAN 0012345678" },
        { kind: "income", description: "TRSF E-BANKING CR GAJI PT CONTOH 092026" },
        { kind: "expense", description: "GAJI PT CONTOH" },
        { kind: "expense", description: "ZQXV WPLM" },
      ],
      history,
    );
    expect(result).toEqual(["kopi", "gaji", null, null]);
  });

  it("kata generik bank tidak dihitung sebagai kemiripan", () => {
    expect(descriptionTokens("TRSF E-BANKING QRIS DEBIT ke 12345678")).toEqual([]);
  });
});
