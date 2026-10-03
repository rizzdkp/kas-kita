import { describe, expect, it } from "vitest";
import type { InsightFact } from "@/server/insights/facts";
import { composeInsights, type InsightWriter } from "@/server/insights/compose";
import { factPlaceholders } from "@/server/insights/placeholders";
import { fillSentence, validateSentence } from "@/server/insights/sentence";
import { INSIGHT_TEMPLATES, templateSentence } from "@/server/insights/templates";

const CAT = "0190a0a0-0000-7000-8000-000000000001";

const naik: InsightFact = {
  kind: "kategori_naik",
  categoryId: CAT,
  categoryName: "Makan dan minum",
  current: "450000",
  average: "300000",
  increasePercent: 50,
  link: { categoryIds: [CAT], from: "2026-09-21", to: "2026-09-27" },
};

const total: InsightFact = { kind: "total_minggu", total: "1250000", count: 14, link: { kinds: ["expense"], from: "2026-09-21", to: "2026-09-27" } };

const tagihan: InsightFact = {
  kind: "tagihan",
  billId: "0190a0a0-0000-7000-8000-000000000002",
  name: "Listrik",
  amount: "350000",
  dueOn: "2026-10-03",
  link: { q: "Listrik" },
};

describe("validateSentence (F-AI-2 AC2)", () => {
  const p = factPlaceholders(naik);

  it("menerima kalimat yang semua angkanya lewat placeholder", () => {
    expect(validateSentence("Pengeluaran {{kategori_1}} minggu lalu {{nominal_1}}, naik {{persen_1}}.", p)).toEqual({ ok: true });
  });

  it("menerima spasi di dalam kurung kurawal", () => {
    expect(validateSentence("Pengeluaran {{ kategori_1 }} {{nominal_1}} naik {{persen_1}}.", p)).toEqual({ ok: true });
  });

  it.each([
    ["digit liar", "Pengeluaran {{kategori_1}} {{nominal_1}} naik {{persen_1}} dalam 7 hari.", "angka_liar"],
    ["nominal ditulis AI", "Pengeluaran {{kategori_1}} Rp 450.000 naik {{persen_1}}, total {{nominal_1}}.", "angka_liar"],
    ["persen ditulis AI", "{{kategori_1}} {{nominal_1}} naik {{persen_1}}, sekitar 50%.", "angka_liar"],
    ["simbol persen", "{{kategori_1}} {{nominal_1}} naik {{persen_1}} %.", "angka_liar"],
    ["angka Arab-Indic", "{{kategori_1}} {{nominal_1}} naik {{persen_1}} ٣.", "angka_liar"],
    ["kata bilangan", "{{kategori_1}} {{nominal_1}} naik {{persen_1}}, hampir dua kali biasanya.", "kata_bilangan"],
    ["satuan juta", "{{kategori_1}} {{nominal_1}} naik {{persen_1}}, lebih dari setengah juta.", "kata_bilangan"],
    ["placeholder tak dikenal", "{{kategori_1}} {{nominal_1}} naik {{persen_1}} dari {{nominal_9}}.", "placeholder_tidak_dikenal"],
    ["placeholder fakta lain", "{{kategori_1}} {{nominal_1}} naik {{persen_1}} di {{tagihan_1}}.", "placeholder_tidak_dikenal"],
    ["kurung kurawal rusak", "{{kategori_1}} {{nominal_1}} naik {{persen_1}} {nominal_2}.", "placeholder_tidak_dikenal"],
    ["placeholder wajib hilang", "Pengeluaran {{kategori_1}} naik {{persen_1}}.", "placeholder_wajib_hilang"],
    ["tanda seru", "Wah, {{kategori_1}} {{nominal_1}} naik {{persen_1}}!", "tanda_terlarang"],
    ["emoji", "{{kategori_1}} {{nominal_1}} naik {{persen_1}} 📈", "tanda_terlarang"],
    ["sapaan", "Halo, {{kategori_1}} {{nominal_1}} naik {{persen_1}}.", "sapaan"],
    ["kosong", "   ", "kosong"],
  ])("menolak %s", (_name, text, reason) => {
    expect(validateSentence(text, p)).toEqual({ ok: false, reason });
  });

  it("placeholder opsional boleh dipakai, boleh tidak", () => {
    expect(validateSentence("{{kategori_1}} {{nominal_1}} naik {{persen_1}} dari {{nominal_2}}.", p).ok).toBe(true);
  });

  it("menolak kalimat terlalu panjang", () => {
    expect(validateSentence(`{{kategori_1}} {{nominal_1}} {{persen_1}} ${"kata ".repeat(60)}`, p)).toEqual({ ok: false, reason: "terlalu_panjang" });
  });
});

describe("fillSentence dan templat (AC4)", () => {
  it("menyisipkan nilai terformat dari fakta", () => {
    // 450.000 vs rata-rata 300.000: naik 150.000 = 50% dari 300.000
    expect(fillSentence("{{kategori_1}} {{nominal_1}} naik {{persen_1}} dari {{nominal_2}}.", factPlaceholders(naik))).toBe(
      "Makan dan minum Rp 450.000 naik 50% dari Rp 300.000.",
    );
  });

  it("nilai yang disisipkan tidak dipindai ulang sebagai placeholder", () => {
    const odd: InsightFact = { ...naik, categoryName: "{{nominal_1}}" };
    expect(fillSentence("{{kategori_1}} {{nominal_1}}", factPlaceholders(odd))).toBe("{{nominal_1}} Rp 450.000");
  });

  it("templat setiap jenis memakai semua placeholder wajib dan lolos validasi struktur", () => {
    const facts: InsightFact[] = [
      naik,
      { kind: "kategori_baru", categoryId: CAT, categoryName: "Hobi", current: "200000", link: {} },
      { kind: "anggaran_lewat", categoryId: CAT, categoryName: "Belanja dapur", usedPercent: 112.5, link: {} },
      { kind: "anggaran_cepat", categoryId: CAT, categoryName: "Transportasi", usedPercent: 70, elapsedPercent: 40, link: {} },
      tagihan,
      total,
    ];
    for (const f of facts) {
      const p = factPlaceholders(f);
      const used = [...INSIGHT_TEMPLATES[f.kind].matchAll(/\{\{([a-z]+_\d+)\}\}/g)].map((m) => m[1]);
      for (const [name, spec] of Object.entries(p)) if (spec.required) expect(used).toContain(name);
      expect(templateSentence(f)).not.toMatch(/\{\{/);
    }
    expect(templateSentence(total)).toBe("Total pengeluaran minggu lalu Rp 1.250.000 dari 14 transaksi.");
    expect(templateSentence(tagihan)).toBe("Tagihan Listrik Rp 350.000 jatuh tempo 3 Okt.");
    expect(templateSentence(facts[3]!)).toBe("Anggaran wajib Transportasi sudah terpakai 70%, padahal bulan baru berjalan 40%.");
  });
});

describe("composeInsights", () => {
  const facts = [
    { fact: naik, sourceTransactionIds: ["a"] },
    { fact: total, sourceTransactionIds: ["a", "b"] },
  ];

  it("tanpa AI semua dari templat", async () => {
    const out = await composeInsights(facts, null);
    expect(out.map((o) => o.generatedBy)).toEqual(["template", "template"]);
    expect(out[0]!.sourceTransactionIds).toEqual(["a"]);
  });

  it("kalimat AI yang lolos dipakai, yang menulis angka jatuh ke templat untuk wawasan itu saja", async () => {
    const writer: InsightWriter = async () =>
      new Map([
        ["kategori_naik", "Minggu lalu {{kategori_1}} mencapai {{nominal_1}}, {{persen_1}} di atas biasanya."],
        ["total_minggu", "Minggu lalu ada 14 transaksi senilai {{nominal_1}} ({{jumlah_1}})."],
      ]);
    const out = await composeInsights(facts, writer);
    expect(out[0]).toMatchObject({ generatedBy: "ai", text: "Minggu lalu Makan dan minum mencapai Rp 450.000, 50% di atas biasanya." });
    expect(out[1]).toMatchObject({ generatedBy: "template", rejected: "angka_liar", text: "Total pengeluaran minggu lalu Rp 1.250.000 dari 14 transaksi." });
  });

  it("AI gagal atau melempar: templat", async () => {
    expect((await composeInsights(facts, async () => null)).every((o) => o.generatedBy === "template")).toBe(true);
    const thrower: InsightWriter = async () => {
      throw new Error("jaringan");
    };
    expect((await composeInsights(facts, thrower)).every((o) => o.generatedBy === "template")).toBe(true);
  });

  it("jenis yang tidak dijawab AI memakai templat", async () => {
    const out = await composeInsights(facts, async () => new Map());
    expect(out.map((o) => o.rejected)).toEqual(["tidak_ada", "tidak_ada"]);
  });
});
