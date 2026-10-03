import type { CategoryToneInput } from "@/components/categories/category-tones";
import type { Asset3DName } from "./asset-names";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// nama kategori seed DATA-MODEL bagian 4; menang atas ikon karena ikon seed dipakai ulang (gift, file-text)
const BY_NAME: Record<string, Asset3DName> = {
  "makan dan minum": "steaming-bowl",
  transportasi: "motor-scooter",
  rumah: "house",
  "tagihan dan langganan": "receipt",
  kesehatan: "pill",
  pendidikan: "graduation-cap",
  "belanja pribadi": "shopping-bags",
  hiburan: "popcorn",
  "hadiah dan donasi": "wrapped-gift",
  keluarga: "people-hugging",
  "biaya bank dan admin": "bank",
  "biaya bank": "bank",
  pajak: "classical-building",
  lainnya: "package",
  gaji: "briefcase",
  bonus: "party-popper",
  "usaha sampingan": "convenience-store",
  "bunga dan imbal hasil": "seedling",
  "pengembalian dana": "counterclockwise-arrows-button",
  transfer: "left-right-arrow",
  "penyesuaian saldo": "balance-scale",
};

// kunci ikon Lucide di categories.icon (settings/category-icons.ts); dipakai anak seed dan kategori buatan pengguna
const BY_ICON: Record<string, Asset3DName> = {
  utensils: "steaming-bowl",
  "utensils-crossed": "fork-and-knife-with-plate",
  "shopping-basket": "shopping-cart",
  coffee: "hot-beverage",
  car: "automobile",
  bike: "motor-scooter",
  bus: "bus",
  fuel: "fuel-pump",
  "square-parking": "motorway",
  plane: "airplane",
  house: "house",
  "key-round": "key",
  zap: "high-voltage",
  droplet: "droplet",
  wifi: "globe-with-meridians",
  smartphone: "mobile-phone",
  receipt: "receipt",
  "heart-pulse": "pill",
  pill: "pill",
  dumbbell: "running-shoe",
  "graduation-cap": "graduation-cap",
  "book-open": "books",
  "shopping-bag": "shopping-bags",
  shirt: "t-shirt",
  clapperboard: "popcorn",
  music: "musical-notes",
  gift: "wrapped-gift",
  users: "people-hugging",
  baby: "baby-bottle",
  "paw-print": "paw-prints",
  landmark: "bank",
  "credit-card": "credit-card",
  "file-text": "page-facing-up",
  briefcase: "briefcase",
  sparkles: "party-popper",
  store: "convenience-store",
  "trending-up": "chart-increasing",
  "piggy-bank": "coin",
  wallet: "purse",
  banknote: "dollar-banknote",
  "undo-2": "counterclockwise-arrows-button",
  tag: "label",
  "circle-ellipsis": "package",
  circle: "package",
  scale: "balance-scale",
  "arrow-left-right": "left-right-arrow",
};

/** Aset 3D kategori: nama sendiri, ikon sendiri, lalu nama dan ikon induk. Null bila tidak dikenal (pemanggil pakai ikon Lucide). */
export function categoryAsset(input: CategoryToneInput): Asset3DName | null {
  const own = (input.name ? BY_NAME[normalize(input.name)] : undefined) ?? (input.icon ? BY_ICON[input.icon] : undefined);
  const found = own ?? (input.parentName ? BY_NAME[normalize(input.parentName)] : undefined) ?? (input.parentIcon ? BY_ICON[input.parentIcon] : undefined);
  if (!found) return null;
  // hadiah yang diterima: amplop angpau, bukan kado yang diberikan
  if (input.kind === "income" && found === "wrapped-gift") return "red-envelope";
  return found;
}
