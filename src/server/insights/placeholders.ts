import { formatShortDate, parseDateKey } from "@/lib/dates";
import { deserializeMoney, formatPercent, formatRupiah } from "@/lib/money";
import type { InsightFact } from "./facts";

export interface PlaceholderSpec {
  /** Arti placeholder untuk prompt; tanpa nilai. */
  description: string;
  required: boolean;
  value: string;
}

export type Placeholders = Record<string, PlaceholderSpec>;

const countFormatter = new Intl.NumberFormat("id-ID");

function shortDate(key: string): string {
  const d = parseDateKey(key);
  return d ? formatShortDate(d) : key;
}

/** Nilai terformat untuk setiap placeholder fakta; satu-satunya sumber angka di kalimat wawasan (F-AI-2 AC2). */
export function factPlaceholders(f: InsightFact): Placeholders {
  switch (f.kind) {
    case "kategori_naik":
      return {
        kategori_1: { description: "nama kategori", required: true, value: f.categoryName },
        nominal_1: { description: "pengeluaran kategori itu minggu lalu", required: true, value: formatRupiah(deserializeMoney(f.current)) },
        persen_1: { description: "besar kenaikan dibanding rata-rata mingguan sebelumnya", required: true, value: formatPercent(f.increasePercent) },
        nominal_2: { description: "rata-rata pengeluaran mingguan kategori itu sebelumnya", required: false, value: formatRupiah(deserializeMoney(f.average)) },
      };
    case "kategori_baru":
      return {
        kategori_1: { description: "nama kategori", required: true, value: f.categoryName },
        nominal_1: { description: "pengeluaran kategori itu minggu lalu; minggu-minggu sebelumnya tidak ada", required: true, value: formatRupiah(deserializeMoney(f.current)) },
      };
    case "anggaran_lewat":
      return {
        kategori_1: { description: "nama kategori anggaran wajib", required: true, value: f.categoryName },
        persen_1: { description: "persen anggaran yang sudah terpakai, di atas batas", required: true, value: formatPercent(f.usedPercent) },
      };
    case "anggaran_cepat":
      return {
        kategori_1: { description: "nama kategori anggaran wajib", required: true, value: f.categoryName },
        persen_1: { description: "persen anggaran yang sudah terpakai", required: true, value: formatPercent(f.usedPercent) },
        persen_2: { description: "persen bulan yang sudah berjalan", required: true, value: formatPercent(f.elapsedPercent) },
      };
    case "tagihan":
      return {
        tagihan_1: { description: "nama tagihan", required: true, value: f.name },
        nominal_1: { description: "nominal tagihan", required: true, value: formatRupiah(deserializeMoney(f.amount)) },
        tanggal_1: { description: "tanggal jatuh tempo minggu ini", required: true, value: shortDate(f.dueOn) },
      };
    case "total_minggu":
      return {
        nominal_1: { description: "total pengeluaran minggu lalu", required: true, value: formatRupiah(deserializeMoney(f.total)) },
        jumlah_1: { description: "banyaknya transaksi pengeluaran minggu lalu", required: true, value: countFormatter.format(f.count) },
      };
  }
}
