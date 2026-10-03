import type { MonthFlow } from "@/server/queries/reports";

/** Judul menjawab pertanyaan: berapa bulan pengeluaran melebihi pemasukan. */
export function trendTitle(trend: MonthFlow[]): string {
  const active = trend.filter((t) => t.income > 0n || t.expense > 0n);
  if (active.length === 0) return "Belum ada transaksi 12 bulan terakhir";
  const deficit = active.filter((t) => t.expense > t.income).length;
  if (deficit === 0) return `Pemasukan lebih besar dari pengeluaran di semua ${active.length} bulan tercatat`;
  return `Pengeluaran melebihi pemasukan di ${deficit} dari ${active.length} bulan tercatat`;
}
