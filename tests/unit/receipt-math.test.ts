import { describe, expect, it } from "vitest";
import { fitWithin } from "@/components/receipts/compress-image";
import { blockingReason, initialFormState, toSavePayload } from "@/components/receipts/receipt-form-model";
import { groupLinesByCategory, isReceiptMismatch, mismatchMessage, primaryCategoryId, splitNote, sumLines } from "@/components/receipts/receipt-math";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { normalizeReceipt, receiptAiSchema } from "@/server/ai/schemas/receipt";

describe("selisih jumlah item dan total (F-IN-3 AC2)", () => {
  it("tepat 2% tidak ditandai, di atas 2% ditandai", () => {
    // total 100.000: batas 2.000
    expect(isReceiptMismatch(98_000n, 100_000n)).toBe(false);
    expect(isReceiptMismatch(102_000n, 100_000n)).toBe(false);
    expect(isReceiptMismatch(97_999n, 100_000n)).toBe(true);
    expect(isReceiptMismatch(102_001n, 100_000n)).toBe(true);
  });

  it("contoh UX-FLOWS 5: 187.000 vs 192.000 selisih 2,6% memunculkan banner", () => {
    expect(mismatchMessage(187_000n, 192_000n, 5)).toBe("Jumlah item Rp 187.000, total struk Rp 192.000. Cek item yang terlewat.");
    expect(mismatchMessage(191_000n, 192_000n, 5)).toBeNull();
  });

  it("tanpa item atau tanpa total tidak ada banner", () => {
    expect(mismatchMessage(0n, 192_000n, 0)).toBeNull();
    expect(mismatchMessage(5_000n, null, 1)).toBeNull();
  });
});

describe("penggabungan item per kategori", () => {
  const lines = [
    { name: "Beras", amount: 72_900n, categoryId: "dapur" },
    { name: "Aqua", amount: 9_000n, categoryId: "jajan" },
    { name: "Telur", amount: 28_500n, categoryId: "dapur" },
    { name: "Hemat", amount: -1_600n, categoryId: "dapur" },
    { name: "Chitato", amount: 11_900n, categoryId: "jajan" },
  ];

  it("item berkategori sama jadi satu grup, urut kemunculan pertama, potongan ikut mengurangi", () => {
    const groups = groupLinesByCategory(lines);
    expect(groups.map((g) => [g.categoryId, g.amount])).toEqual([
      ["dapur", 99_800n], // 72.900 + 28.500 − 1.600
      ["jajan", 20_900n], // 9.000 + 11.900
    ]);
    expect(groups[0]!.names).toEqual(["Beras", "Telur", "Hemat"]);
    expect(sumLines(groups)).toBe(sumLines(lines));
  });

  it("kategori utama adalah grup terbesar", () => {
    expect(primaryCategoryId(groupLinesByCategory(lines))).toBe("dapur");
    expect(primaryCategoryId([{ categoryId: null, amount: 5n, names: [] }])).toBeNull();
  });

  it("catatan split dipotong di 500 karakter", () => {
    expect(splitNote([])).toBeNull();
    expect(splitNote(["a".repeat(600)])!.length).toBe(500);
  });
});

describe("normalisasi output model", () => {
  const categories = [
    { id: "c1", name: "Belanja dapur" },
    { id: "c2", name: "Kopi dan jajan" },
  ];

  it("nama kategori di luar daftar jadi kosong, angka dibulatkan, tanggal masa depan dibuang", () => {
    const parsed = receiptAiSchema.parse({
      merchant: "  Indomaret ",
      date: "2026-12-01",
      time: "7.05",
      total: 25000.4,
      items: [
        { name: "Beras", amount: 20000, categoryName: "belanja  DAPUR" },
        { name: "Sabun", amount: 5000.6, categoryName: "Kebersihan" },
      ],
    });
    const draft = normalizeReceipt(parsed, categories, "2026-09-24");
    expect(draft).toEqual({
      merchant: "Indomaret",
      date: null,
      time: "07:05",
      total: 25_000n,
      items: [
        { name: "Beras", amount: 20_000n, categoryId: "c1" },
        { name: "Sabun", amount: 5_001n, categoryId: null },
      ],
    });
  });

  it("field yang hilang dianggap kosong", () => {
    const draft = normalizeReceipt(receiptAiSchema.parse({ items: [] }), categories, "2026-09-24");
    expect(draft).toEqual({ merchant: null, date: null, time: null, total: null, items: [] });
  });
});

describe("kompres di browser (F-IN-3 AC1)", () => {
  it("sisi terpanjang jadi 1600 px, gambar kecil tidak diperbesar", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("model form pratinjau", () => {
  const options: TransactionFormOptions = {
    accounts: [{ id: "acc", name: "BCA", type: "bank", ownerId: "me", archived: false }],
    categories: { expense: [], income: [] },
    people: { me: { id: "me", name: "Rizz", color: "violet" }, partner: null },
    defaults: { accountId: null, categoryId: null },
  };
  const draft = {
    merchant: "Indomaret",
    date: "2026-09-20",
    time: "19:42",
    total: 30_000n,
    items: [
      { name: "Beras", amount: 20_000n, categoryId: "dapur" },
      { name: "Aqua", amount: 9_000n, categoryId: "jajan" },
    ],
  };

  it("dua kategori berarti default dipecah; selisih 1.000 memblokir simpan terpecah", () => {
    const state = initialFormState(draft, options, "acc");
    expect(state.mode).toBe("split");
    expect(state.categoryId).toBe("dapur");
    expect(state.occurredLocal).toBe("2026-09-20T19:42");
    expect(blockingReason(state)).toBe("Samakan jumlah item dengan total sebelum memecah per kategori.");
    const single = { ...state, mode: "single" as const };
    expect(blockingReason(single)).toBeNull();
    expect(toSavePayload(single, options, "att", "client-1234")).toMatchObject({ mode: "single", amount: 30_000n, categoryId: "dapur", note: "Indomaret" });
  });
});
