import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSET_3D_NAMES, ASSET_3D_WIDTHS } from "@/components/assets/asset-names";
import { categoryAsset } from "@/components/assets/category-assets";
import { pageArtFor } from "@/components/assets/page-art-map";
import { institutionLogo, institutionMark } from "@/components/brand/institutions";
import { CATEGORY_ICONS } from "@/components/settings/category-icons";
// @ts-expect-error skrip .mjs tanpa deklarasi tipe
import { FLUENT_FOLDERS } from "../../scripts/assets/build-3d.mjs";

const pub = (p: string) => new URL(`../../public${p}`, import.meta.url);
const kebab = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

describe("berkas aset 3D", () => {
  it("daftar nama sama dengan daftar folder di skrip konversi", () => {
    expect((FLUENT_FOLDERS as string[]).map(kebab)).toEqual([...ASSET_3D_NAMES]);
  });

  it("setiap nama punya WebP 64, 128, dan 256 yang kecil", () => {
    for (const name of ASSET_3D_NAMES) {
      for (const w of ASSET_3D_WIDTHS) {
        const file = pub(`/assets/3d/${name}-${w}.webp`);
        expect(existsSync(file), `${name}-${w}`).toBe(true);
        // batas per berkas supaya satu halaman tetap di bawah ~300 KB saat pertama dibuka
        expect(statSync(file).size, `${name}-${w}`).toBeLessThan(w === 256 ? 40_000 : 16_000);
      }
    }
  });

  it("tidak ada berkas yatim di public/assets/3d", () => {
    const expected = new Set(ASSET_3D_NAMES.flatMap((n) => ASSET_3D_WIDTHS.map((w) => `${n}-${w}.webp`)));
    expect(readdirSync(pub("/assets/3d")).filter((f) => !expected.has(f))).toEqual([]);
  });
});

describe("logo institusi", () => {
  it("14 slug dan aliasnya memakai logo yang ada di public/brands", () => {
    for (const slug of ["bca", "jago", "bank-jago", "gopay", "ovo", "mandiri", "bri", "bni", "dana", "shopee-pay", "seabank", "jenius", "blu", "bca-digital", "cimb-niaga", "permata"]) {
      const logo = institutionLogo(institutionMark(slug));
      expect(logo, slug).not.toBeNull();
      const svg = readFileSync(pub(logo!), "utf8");
      // tanpa namespace SVG tidak tampil lewat <img>
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), slug).toBe(true);
    }
  });

  it("institusi tak dikenal tidak punya logo dan jatuh ke monogram", () => {
    expect(institutionLogo(institutionMark("flip"))).toBeNull();
    expect(institutionLogo(null)).toBeNull();
  });
});

describe("aset kategori", () => {
  it("memetakan induk seed pengeluaran dan pemasukan", () => {
    expect(categoryAsset({ name: "Makan dan minum", icon: "utensils", kind: "expense" })).toBe("steaming-bowl");
    expect(categoryAsset({ name: "Transportasi", icon: "car" })).toBe("motor-scooter");
    expect(categoryAsset({ name: "Pajak", icon: "file-text" })).toBe("classical-building");
    expect(categoryAsset({ name: "Gaji", icon: "briefcase", kind: "income" })).toBe("briefcase");
    expect(categoryAsset({ name: "Bunga dan imbal hasil", icon: "trending-up", kind: "income" })).toBe("seedling");
    expect(categoryAsset({ name: "Transfer", icon: "arrow-left-right", kind: "transfer" })).toBe("left-right-arrow");
  });

  it("hadiah yang diterima memakai angpau, hadiah yang diberikan memakai kado", () => {
    expect(categoryAsset({ name: "Hadiah", icon: "gift", kind: "income" })).toBe("red-envelope");
    expect(categoryAsset({ name: "Hadiah dan donasi", icon: "gift", kind: "expense" })).toBe("wrapped-gift");
  });

  it("anak seed memakai ikonnya sendiri, lalu induk", () => {
    expect(categoryAsset({ name: "Bensin", icon: "fuel", parentName: "Transportasi", parentIcon: "car" })).toBe("fuel-pump");
    expect(categoryAsset({ name: "Kopi dan jajan", icon: "coffee", parentName: "Makan dan minum" })).toBe("hot-beverage");
    expect(categoryAsset({ name: "Cicilan motor", icon: "not-an-icon", parentName: "Transportasi", parentIcon: "car" })).toBe("motor-scooter");
  });

  it("semua ikon yang bisa dipilih pengguna punya aset", () => {
    for (const { key } of CATEGORY_ICONS) expect(categoryAsset({ name: "Buatan pengguna", icon: key }), key).not.toBeNull();
  });

  it("kategori tak dikenal kembali null supaya ikon Lucide dipakai", () => {
    expect(categoryAsset({ name: "Buatan pengguna", icon: "rocket" })).toBeNull();
    expect(categoryAsset({})).toBeNull();
  });
});

describe("aset kepala halaman", () => {
  it("setiap halaman app punya aset dan turunan memakai induk", () => {
    for (const path of ["/", "/transaksi", "/akun", "/anggaran", "/tagihan", "/target", "/investasi", "/laporan", "/impor", "/transaksi/berulang", "/pengaturan", "/notifikasi"]) {
      expect(pageArtFor(path), path).not.toBeNull();
    }
    expect(pageArtFor("/impor/0193")).toEqual(pageArtFor("/impor"));
    expect(pageArtFor("/transaksi/berulang")?.[0]).toBe("repeat-button");
  });

  it("rute tak dikenal tidak jatuh ke aset Ringkasan", () => {
    expect(pageArtFor("/dev/komponen")).toBeNull();
  });
});
