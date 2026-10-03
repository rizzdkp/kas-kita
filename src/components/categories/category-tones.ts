/** Nada kategori: token --cat-<nada>-bg/-fg. Tidak ada merah, hijau, atau teal supaya tidak tertukar dengan attention, positive, dan accent. */
export const CHROMATIC_TONES = ["orange", "mustard", "sky", "indigo", "purple", "pink", "magenta", "brown", "olive", "slate"] as const;
export const CATEGORY_TONES = [...CHROMATIC_TONES, "gray", "sand"] as const;

export type CategoryTone = (typeof CATEGORY_TONES)[number] | "neutral";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// induk seed DATA-MODEL bagian 4; anak mewarisi warna induk
const BY_ROOT_NAME: Record<string, CategoryTone> = {
  "makan dan minum": "orange",
  transportasi: "sky",
  rumah: "brown",
  "tagihan dan langganan": "indigo",
  kesehatan: "pink",
  pendidikan: "purple",
  "belanja pribadi": "mustard",
  hiburan: "magenta",
  "hadiah dan donasi": "pink",
  keluarga: "olive",
  "biaya bank dan admin": "slate",
  "biaya bank": "slate",
  pajak: "gray",
  lainnya: "neutral",
  gaji: "sand",
  bonus: "sand",
  "usaha sampingan": "sand",
  hadiah: "sand",
  "bunga dan imbal hasil": "sand",
  "pengembalian dana": "sand",
  transfer: "neutral",
  "penyesuaian saldo": "neutral",
};

// cadangan untuk kategori buatan pengguna tanpa nama induk: ikon menunjukkan keluarganya
const BY_ICON: Record<string, CategoryTone> = {
  utensils: "orange",
  "utensils-crossed": "orange",
  "shopping-basket": "orange",
  coffee: "orange",
  car: "sky",
  bike: "sky",
  bus: "sky",
  fuel: "sky",
  "square-parking": "sky",
  plane: "sky",
  house: "brown",
  "key-round": "brown",
  zap: "brown",
  droplet: "brown",
  wifi: "brown",
  receipt: "indigo",
  smartphone: "indigo",
  "heart-pulse": "pink",
  pill: "pink",
  dumbbell: "pink",
  "graduation-cap": "purple",
  "book-open": "purple",
  "shopping-bag": "mustard",
  shirt: "mustard",
  clapperboard: "magenta",
  music: "magenta",
  gift: "pink",
  users: "olive",
  baby: "olive",
  "paw-print": "olive",
  landmark: "slate",
  "credit-card": "slate",
  "file-text": "gray",
  "circle-ellipsis": "neutral",
  scale: "neutral",
  "arrow-left-right": "neutral",
};

/** Hash stabil (FNV-1a) supaya kategori yang sama selalu mendapat nada yang sama di setiap render dan perangkat. */
function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface CategoryToneInput {
  name?: string | null;
  icon?: string | null;
  /** Nama induk; null/undefined berarti kategori ini sendiri induk. */
  parentName?: string | null;
  parentIcon?: string | null;
  kind?: "income" | "expense" | "transfer" | "system" | null;
}

export function categoryTone(input: CategoryToneInput): CategoryTone {
  if (input.kind === "transfer" || input.kind === "system") return "neutral";
  const rootName = input.parentName ?? input.name;
  const named = rootName ? BY_ROOT_NAME[normalize(rootName)] : undefined;
  // "Lainnya" ada di pengeluaran dan pemasukan; nada pemasukan menang kecuali netral
  if (input.kind === "income") return named === "neutral" ? "neutral" : "sand";
  if (named) return named;
  // anak dengan induk diketahui hanya membaca ikon induk, supaya semua anak satu induk senada
  const rootIcon = input.parentName ? input.parentIcon : input.icon;
  const byIcon = rootIcon ? BY_ICON[rootIcon] : undefined;
  if (byIcon) return byIcon;
  // hash nama induk, bukan id: baris transaksi hanya membawa nama, dan warnanya harus sama dengan di pilihan kategori
  if (!rootName) return "neutral";
  return CHROMATIC_TONES[stableHash(normalize(rootName)) % CHROMATIC_TONES.length]!;
}

export function toneVars(tone: CategoryTone): { background: string; color: string } {
  if (tone === "neutral") return { background: "var(--surface-sunken)", color: "var(--text-secondary)" };
  return { background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-fg)` };
}
