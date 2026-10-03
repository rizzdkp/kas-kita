import type { Asset3DName } from "./asset-names";

/** Aset utama dan aset kecil pendamping di sudut kanan bawah. */
export type PageArtPair = readonly [main: Asset3DName, accent?: Asset3DName];

// satu peta path -> aset; isi halaman yang dipilih, bukan dekorasi acak
const PAGE_ART: Record<string, PageArtPair> = {
  "/": ["money-bag", "coin"],
  "/transaksi": ["ledger", "receipt"],
  "/transaksi/berulang": ["repeat-button", "spiral-calendar"],
  "/akun": ["credit-card", "coin"],
  "/anggaran": ["abacus", "coin"],
  "/tagihan": ["spiral-calendar"],
  "/target": ["bullseye"],
  "/investasi": ["chart-increasing"],
  "/laporan": ["bar-chart", "clipboard"],
  "/impor": ["inbox-tray"],
  "/pengaturan": ["gear"],
  "/notifikasi": ["bell"],
  "/struk": ["receipt"],
  "/mulai": ["house-with-garden"],
};

/** Aset kepala halaman untuk path; turunan memakai aset induk terdekat (mis. /impor/123 -> /impor). */
export function pageArtFor(pathname: string): PageArtPair | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return PAGE_ART["/"] ?? null;
  // Ringkasan tidak menjadi cadangan untuk rute lain
  for (let i = segments.length; i > 0; i--) {
    const art = PAGE_ART[`/${segments.slice(0, i).join("/")}`];
    if (art) return art;
  }
  return null;
}
