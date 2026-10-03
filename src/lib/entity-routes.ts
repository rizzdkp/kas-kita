// tautan notifikasi ke halaman entitas; dipakai panel notifikasi dan web push supaya keduanya membuka tempat yang sama
export const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  transactions: (id) => `/transaksi?id=${id}`,
  accounts: (id) => `/akun?id=${id}`,
  bills: (id) => `/tagihan?id=${id}`,
  goals: (id) => `/target?id=${id}`,
  goal_contributions: () => "/target",
  budgets: () => "/anggaran",
  categories: () => "/pengaturan#kategori",
  recurring_rules: () => "/transaksi/berulang",
  investment_valuations: () => "/investasi",
};
