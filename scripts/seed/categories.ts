/** Seed kategori persis DATA-MODEL bagian 4; ikon nama Lucide kebab-case (DESIGN.md bagian 9). */
export interface SeedCategory {
  name: string;
  icon: string;
  children?: Array<{ name: string; icon: string }>;
}

export const EXPENSE_CATEGORIES: SeedCategory[] = [
  {
    name: "Makan dan minum",
    icon: "utensils",
    children: [
      { name: "Belanja dapur", icon: "shopping-basket" },
      { name: "Makan di luar", icon: "utensils-crossed" },
      { name: "Kopi dan jajan", icon: "coffee" },
    ],
  },
  {
    name: "Transportasi",
    icon: "car",
    children: [
      { name: "Bensin", icon: "fuel" },
      { name: "Ojek dan taksi", icon: "bike" },
      { name: "Parkir dan tol", icon: "square-parking" },
    ],
  },
  {
    name: "Rumah",
    icon: "house",
    children: [
      { name: "Sewa atau cicilan", icon: "key-round" },
      { name: "Listrik", icon: "zap" },
      { name: "Air", icon: "droplet" },
      { name: "Internet", icon: "wifi" },
    ],
  },
  { name: "Tagihan dan langganan", icon: "receipt" },
  { name: "Kesehatan", icon: "heart-pulse" },
  { name: "Pendidikan", icon: "graduation-cap" },
  { name: "Belanja pribadi", icon: "shopping-bag" },
  { name: "Hiburan", icon: "clapperboard" },
  { name: "Hadiah dan donasi", icon: "gift" },
  { name: "Keluarga", icon: "users" },
  { name: "Biaya bank dan admin", icon: "landmark" },
  { name: "Pajak", icon: "file-text" },
  { name: "Lainnya", icon: "circle-ellipsis" },
];

export const INCOME_CATEGORIES: SeedCategory[] = [
  { name: "Gaji", icon: "briefcase" },
  { name: "Bonus", icon: "sparkles" },
  { name: "Usaha sampingan", icon: "store" },
  { name: "Hadiah", icon: "gift" },
  { name: "Bunga dan imbal hasil", icon: "trending-up" },
  { name: "Pengembalian dana", icon: "undo-2" },
  { name: "Lainnya", icon: "circle-ellipsis" },
];

export const SYSTEM_CATEGORIES = [
  { name: "Penyesuaian saldo", icon: "scale", systemKey: "adjustment" },
  { name: "Transfer", icon: "arrow-left-right", systemKey: "transfer" },
] as const;
