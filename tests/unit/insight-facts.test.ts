import { describe, expect, it } from "vitest";
import { selectFacts, type CollectedFact, type InsightFact } from "@/server/insights/facts";
import { pickBillFact, pickBudgetFact, pickCategoryFact, weeklyAverage, type BudgetPace } from "@/server/insights/pick";
import { mondayOf, summarizedWeekStart, weekEnd } from "@/server/insights/week";

const MAKAN = "0190a0a0-0000-7000-8000-00000000000a";
const TRANSPORT = "0190a0a0-0000-7000-8000-00000000000b";
const HOBI = "0190a0a0-0000-7000-8000-00000000000c";

describe("minggu yang dirangkum", () => {
  it("Senin 5 Okt 2026 merangkum 28 Sep - 4 Okt", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(summarizedWeekStart("2026-10-05")).toBe("2026-09-28");
    expect(weekEnd("2026-09-28")).toBe("2026-10-04");
  });
  it("Minggu 4 Okt masih membaca minggu 21-27 Sep", () => {
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(summarizedWeekStart("2026-10-04")).toBe("2026-09-21");
  });
});

describe("pickCategoryFact (rata-rata 4 minggu sebelumnya)", () => {
  it("memilih kenaikan rupiah terbesar dan menghitung persennya", () => {
    // Makan: minggu lalu 600.000; 4 minggu sebelumnya 1.600.000 -> rata-rata 400.000; naik 200.000 = 50%
    // Transportasi: minggu lalu 300.000; 4 minggu sebelumnya 400.000 -> rata-rata 100.000; naik 200.000 juga, kalah urutan nama
    // Hobi: minggu lalu 150.000; sebelumnya 0 -> naik 150.000, kalah dari 200.000
    const fact = pickCategoryFact(
      [
        { categoryId: MAKAN, name: "Makan dan minum", total: 600_000n },
        { categoryId: TRANSPORT, name: "Transportasi", total: 300_000n },
        { categoryId: HOBI, name: "Hobi", total: 150_000n },
      ],
      [
        { categoryId: MAKAN, name: "Makan dan minum", total: 1_600_000n },
        { categoryId: TRANSPORT, name: "Transportasi", total: 400_000n },
      ],
    );
    expect(fact).toEqual({
      kind: "kategori_naik",
      categoryId: MAKAN,
      categoryName: "Makan dan minum",
      current: "600000",
      average: "400000",
      increasePercent: 50,
    });
  });

  it("kategori tanpa riwayat menjadi kategori_baru", () => {
    // Hobi 150.000 tanpa riwayat; Makan 410.000 vs rata-rata 400.000 hanya naik 10.000
    const fact = pickCategoryFact(
      [
        { categoryId: MAKAN, name: "Makan dan minum", total: 410_000n },
        { categoryId: HOBI, name: "Hobi", total: 150_000n },
      ],
      [{ categoryId: MAKAN, name: "Makan dan minum", total: 1_600_000n }],
    );
    expect(fact).toEqual({ kind: "kategori_baru", categoryId: HOBI, categoryName: "Hobi", current: "150000" });
  });

  it("tidak ada kenaikan: null", () => {
    expect(pickCategoryFact([{ categoryId: MAKAN, name: "Makan", total: 100n }], [{ categoryId: MAKAN, name: "Makan", total: 800n }])).toBeNull();
  });

  it("rata-rata dibulatkan setengah ke atas", () => {
    expect(weeklyAverage(10n)).toBe(3n); // 2,5 -> 3
    expect(weeklyAverage(9n)).toBe(2n); // 2,25 -> 2
    expect(weeklyAverage(1n)).toBe(1n); // 0,25 -> minimal 1
    expect(weeklyAverage(0n)).toBe(0n);
  });
});

const budget = (b: Partial<BudgetPace>): BudgetPace => ({
  categoryId: MAKAN,
  categoryName: "Belanja dapur",
  ownerId: null,
  isMandatory: true,
  state: "on_track",
  usedPercent: 10,
  elapsedPercent: 50,
  fasterThanUsual: false,
  ...b,
});

describe("pickBudgetFact (anggaran wajib)", () => {
  it("anggaran lewat didahulukan, yang fleksibel diabaikan", () => {
    const out = pickBudgetFact([
      budget({ categoryName: "Hobi", isMandatory: false, state: "over", usedPercent: 300 }),
      budget({ categoryName: "Transportasi", fasterThanUsual: true, usedPercent: 90, elapsedPercent: 40 }),
      budget({ categoryName: "Belanja dapur", state: "over", usedPercent: 112.5 }),
    ]);
    expect(out?.fact).toEqual({ kind: "anggaran_lewat", categoryId: MAKAN, categoryName: "Belanja dapur", usedPercent: 112.5 });
  });

  it("laju tercepat: selisih terpakai dan hari berlalu terbesar", () => {
    // A: 70 - 40 = 30 poin; B: 90 - 50 = 40 poin
    const out = pickBudgetFact([
      budget({ categoryName: "A", fasterThanUsual: true, usedPercent: 70, elapsedPercent: 40 }),
      budget({ categoryName: "B", fasterThanUsual: true, usedPercent: 90, elapsedPercent: 50 }),
    ]);
    expect(out?.fact).toMatchObject({ kind: "anggaran_cepat", categoryName: "B", usedPercent: 90, elapsedPercent: 50 });
  });

  it("tidak ada yang perlu disebut: null", () => {
    expect(pickBudgetFact([budget({})])).toBeNull();
  });
});

describe("pickBillFact", () => {
  const bills = [
    { id: "0190a0a0-0000-7000-8000-000000000101", name: "Internet", amount: 400_000n, nextDueOn: "2026-10-12", categoryId: null },
    { id: "0190a0a0-0000-7000-8000-000000000102", name: "Listrik", amount: 350_000n, nextDueOn: "2026-10-07", categoryId: null },
    { id: "0190a0a0-0000-7000-8000-000000000103", name: "Air", amount: 90_000n, nextDueOn: "2026-10-11", categoryId: null },
  ];
  it("tagihan terdekat dalam 7 hari (Senin 5 Okt sampai Minggu 11 Okt)", () => {
    expect(pickBillFact(bills, "2026-10-05")?.fact).toMatchObject({ name: "Listrik", amount: "350000", dueOn: "2026-10-07" });
    expect(pickBillFact(bills.filter((b) => b.name !== "Listrik"), "2026-10-05")?.fact.name).toBe("Air");
    expect(pickBillFact([bills[0]!], "2026-10-05")).toBeNull();
  });
});

describe("selectFacts", () => {
  it("maksimal tiga, total minggu dibuang lebih dulu", () => {
    const mk = (fact: InsightFact): CollectedFact => ({ fact, sourceTransactionIds: [] });
    const out = selectFacts([
      mk({ kind: "total_minggu", total: "1", count: 1, link: {} }),
      mk({ kind: "tagihan", billId: bills0(), name: "Listrik", amount: "1", dueOn: "2026-10-07", link: {} }),
      mk({ kind: "anggaran_cepat", categoryId: MAKAN, categoryName: "A", usedPercent: 1, elapsedPercent: 1, link: {} }),
      mk({ kind: "kategori_baru", categoryId: HOBI, categoryName: "Hobi", current: "1", link: {} }),
    ]);
    expect(out.map((f) => f.fact.kind)).toEqual(["kategori_baru", "anggaran_cepat", "tagihan"]);
  });
});

function bills0(): string {
  return "0190a0a0-0000-7000-8000-000000000102";
}
