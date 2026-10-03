// G2 refraksi (DESIGN 5.5): deteksi dan peta displacement, tanpa DOM supaya bisa diuji

export const LENS_BAND_PX = 10;
export const LENS_SCALE = 18;
export const LENS_BLUR = 0.6;
const NEUTRAL = 128;

export interface G2Environment {
  /** CSS.supports("backdrop-filter", "url(#x)") */
  supportsUrlBackdrop: boolean;
  /** navigator.userAgentData.brands[].brand; kosong di Safari dan Firefox */
  brands: readonly string[];
  /** navigator.deviceMemory dalam GB; tidak ada di Safari dan Firefox */
  deviceMemory: number | undefined;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  /** html[data-transparency="reduced"] dari toggle Pengaturan */
  manualReducedTransparency: boolean;
}

export function isG2Enabled(env: G2Environment): boolean {
  if (env.reducedMotion || env.reducedTransparency || env.manualReducedTransparency) return false;
  if (!env.supportsUrlBackdrop) return false;
  if (!env.brands.includes("Chromium")) return false;
  return env.deviceMemory !== undefined && env.deviceMemory >= 4;
}

/**
 * Peta RGBA ukuran width x height: netral 128 di tengah, di pita tepi selebar `band` vektor R/G
 * menunjuk ke luar sepanjang normal tepi persegi bundar, makin kuat makin dekat ke tepi.
 */
export function buildDisplacementMap(width: number, height: number, radius: number, band = LENS_BAND_PX): Uint8ClampedArray {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const hx = cx - r;
  const hy = cy - r;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const qx = Math.abs(dx) - hx;
      const qy = Math.abs(dy) - hy;
      let nx = 0;
      let ny = 0;
      let depth: number;
      if (qx > 0 && qy > 0) {
        // sudut bundar: jarak ke busur, normal dari pusat busur
        const len = Math.hypot(qx, qy);
        depth = r - len;
        nx = (qx / len) * Math.sign(dx);
        ny = (qy / len) * Math.sign(dy);
      } else if (qx > qy) {
        depth = r - qx;
        nx = Math.sign(dx);
      } else {
        depth = r - qy;
        ny = Math.sign(dy);
      }
      let strength = 0;
      if (depth >= 0 && depth < band) strength = (1 - depth / band) ** 2;
      const i = (y * w + x) * 4;
      data[i] = Math.round(NEUTRAL + nx * strength * 127);
      data[i + 1] = Math.round(NEUTRAL + ny * strength * 127);
      data[i + 2] = NEUTRAL;
      data[i + 3] = 255;
    }
  }
  return data;
}
