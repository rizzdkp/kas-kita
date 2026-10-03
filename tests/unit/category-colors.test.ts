import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { institutionMark, institutionMonogram, accountGlyph } from "@/components/brand/institutions";
import { CATEGORY_TONES, categoryTone } from "@/components/categories/category-tones";

const tokens = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

// blok :root pertama = terang; blok :root[data-theme="dark"] = gelap
function block(selector: string): Record<string, string> {
  const start = tokens.indexOf(selector);
  const body = tokens.slice(tokens.indexOf("{", start) + 1, tokens.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("nada kategori", () => {
  it("memetakan induk seed ke nada yang disepakati", () => {
    expect(categoryTone({ name: "Makan dan minum", kind: "expense" })).toBe("orange");
    expect(categoryTone({ name: "Transportasi" })).toBe("sky");
    expect(categoryTone({ name: "Rumah" })).toBe("brown");
    expect(categoryTone({ name: "Tagihan dan langganan" })).toBe("indigo");
    expect(categoryTone({ name: "Hiburan" })).toBe("magenta");
    expect(categoryTone({ name: "Biaya bank dan admin" })).toBe("slate");
    expect(categoryTone({ name: "Pajak" })).toBe("gray");
    expect(categoryTone({ name: "Lainnya", kind: "expense" })).toBe("neutral");
  });

  it("anak mewarisi warna induk, bukan dari ikonnya sendiri", () => {
    expect(categoryTone({ name: "Bensin", icon: "fuel", parentName: "Transportasi", kind: "expense" })).toBe("sky");
    expect(categoryTone({ name: "Kopi dan jajan", icon: "coffee", parentName: "Makan dan minum" })).toBe("orange");
  });

  it("pemasukan selalu sand, transfer dan penyesuaian netral", () => {
    expect(categoryTone({ name: "Gaji", kind: "income" })).toBe("sand");
    expect(categoryTone({ name: "Kategori baru", kind: "income" })).toBe("sand");
    expect(categoryTone({ name: "Lainnya", kind: "income" })).toBe("neutral");
    expect(categoryTone({ icon: "arrow-left-right", kind: "transfer" })).toBe("neutral");
    expect(categoryTone({ name: "Penyesuaian saldo", kind: "expense" })).toBe("neutral");
  });

  it("kategori buatan pengguna: ikon induk lalu hash nama yang stabil", () => {
    expect(categoryTone({ name: "Anak", icon: "baby", kind: "expense" })).toBe("olive");
    const a = categoryTone({ name: "Hobi Foto", icon: "circle", kind: "expense" });
    expect(a).toBe(categoryTone({ name: "  hobi   foto ", icon: "circle", kind: "expense" }));
    expect(a).not.toBe("neutral");
  });

  for (const [mode, selector] of [["terang", ":root {"], ["gelap", ':root[data-theme="dark"]']] as const) {
    it(`kontras ikon terhadap tint >= 3:1 (${mode})`, () => {
      const t = block(selector);
      for (const tone of CATEGORY_TONES) {
        expect(contrast(t[`cat-${tone}-fg`]!, t[`cat-${tone}-bg`]!), tone).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe("lencana institusi", () => {
  it("mengenali slug dan alias", () => {
    expect(institutionMark("bca")?.label).toBe("BCA");
    expect(institutionMark("Bank-Jago")?.token).toBe("jago");
    expect(institutionMark("cimb-niaga")?.token).toBe("cimb");
    expect(institutionMark("bank-tak-dikenal")).toBeNull();
    expect(institutionMark(null)).toBeNull();
  });

  it("monogram dua huruf untuk institusi tak dikenal", () => {
    expect(institutionMonogram("Bank Neo Commerce")).toBe("BN");
    expect(institutionMonogram("Flip")).toBe("Fl");
    expect(institutionMonogram("LinkAja!")).toBe("Li");
  });

  it("ikon jenis untuk akun tanpa institusi", () => {
    expect(accountGlyph("cash")).toBe("cash");
    expect(accountGlyph("investment")).toBe("investment");
    expect(accountGlyph("other_asset")).toBe("asset");
  });

  it("kontras monogram terhadap warna merek >= 4.5:1", () => {
    const t = block(":root {");
    const keys = Object.keys(t).filter((k) => k.startsWith("inst-") && k.endsWith("-bg"));
    expect(keys.length).toBe(14);
    for (const bg of keys) {
      const fg = bg.replace(/-bg$/, "-fg");
      expect(contrast(t[fg]!, t[bg]!), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});
