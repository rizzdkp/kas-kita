import { describe, expect, it } from "vitest";
import { buildDisplacementMap, isG2Enabled, type G2Environment } from "@/components/glass/lens-map";

const chromium: G2Environment = {
  supportsUrlBackdrop: true,
  brands: ["Chromium", "Google Chrome", "Not=A?Brand"],
  deviceMemory: 8,
  reducedMotion: false,
  reducedTransparency: false,
  manualReducedTransparency: false,
};

describe("isG2Enabled (DESIGN 5.5)", () => {
  it("Chromium dengan memori >= 4 GB", () => {
    expect(isG2Enabled(chromium)).toBe(true);
    expect(isG2Enabled({ ...chromium, deviceMemory: 4 })).toBe(true);
  });
  it("memori kecil atau tidak diketahui memakai G1", () => {
    expect(isG2Enabled({ ...chromium, deviceMemory: 2 })).toBe(false);
    expect(isG2Enabled({ ...chromium, deviceMemory: undefined })).toBe(false);
  });
  it("Safari dan Firefox (tanpa merek Chromium atau tanpa url() di backdrop-filter) memakai G1", () => {
    expect(isG2Enabled({ ...chromium, brands: [] })).toBe(false);
    expect(isG2Enabled({ ...chromium, supportsUrlBackdrop: false })).toBe(false);
  });
  it("mati saat gerak atau transparansi dikurangi", () => {
    expect(isG2Enabled({ ...chromium, reducedMotion: true })).toBe(false);
    expect(isG2Enabled({ ...chromium, reducedTransparency: true })).toBe(false);
    expect(isG2Enabled({ ...chromium, manualReducedTransparency: true })).toBe(false);
  });
});

function px(data: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number, number] {
  const i = (y * width + x) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
}

describe("buildDisplacementMap", () => {
  const W = 200;
  const H = 52;
  const R = 22;
  const map = buildDisplacementMap(W, H, R);

  it("ukuran sesuai elemen, RGBA", () => {
    expect(map.length).toBe(W * H * 4);
  });

  it("netral 128 di tengah dan di luar pita tepi 10px", () => {
    expect(px(map, W, 100, 26)).toEqual([128, 128, 128, 255]);
    // 11px dari tepi kiri, di bagian lurus vertikal tengah
    expect(px(map, W, 60, 11)).toEqual([128, 128, 128, 255]);
  });

  it("pita tepi membengkok ke luar sepanjang normal", () => {
    const [rTop, gTop] = px(map, W, 100, 0);
    expect(rTop).toBe(128);
    expect(gTop).toBeLessThan(40);
    const [, gBottom] = px(map, W, 100, H - 1);
    expect(gBottom).toBeGreaterThan(216);
    const [rLeft, gLeft] = px(map, W, 0, 26);
    expect(rLeft).toBeLessThan(40);
    expect(gLeft).toBe(128);
    const [rRight] = px(map, W, W - 1, 26);
    expect(rRight).toBeGreaterThan(216);
  });

  it("makin dekat tepi makin kuat, dan berhenti di 10px", () => {
    const g = (y: number) => px(map, W, 100, y)[1];
    expect(g(0)).toBeLessThan(g(4));
    expect(g(4)).toBeLessThan(g(8));
    expect(g(10)).toBe(128);
  });

  it("sudut bundar: normal diagonal ke luar, luar busur netral", () => {
    // titik di dalam busur kiri atas, dekat tepi busur
    const [r, g] = px(map, W, 8, 8);
    expect(r).toBeLessThan(128);
    expect(g).toBeLessThan(128);
    expect(px(map, W, 0, 0)).toEqual([128, 128, 128, 255]);
  });

  it("radius dijepit ke setengah sisi terpendek (kapsul)", () => {
    const pill = buildDisplacementMap(44, 44, 9999);
    expect(px(pill, 44, 22, 22)).toEqual([128, 128, 128, 255]);
    expect(px(pill, 44, 22, 0)[1]).toBeLessThan(40);
  });
});
