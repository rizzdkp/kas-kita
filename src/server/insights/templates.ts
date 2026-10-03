import type { InsightFact, InsightFactKind } from "./facts";
import { factPlaceholders } from "./placeholders";
import { fillSentence } from "./sentence";

// F-AI-2 AC4: kalimat tetap tanpa AI (COPY.md, Ringkasan); angka tetap disisipkan kode lewat placeholder
export const INSIGHT_TEMPLATES: Record<InsightFactKind, string> = {
  kategori_naik:
    "Pengeluaran {{kategori_1}} minggu lalu {{nominal_1}}, naik {{persen_1}} dari rata-rata 4 minggu sebelumnya {{nominal_2}} per minggu.",
  kategori_baru: "Pengeluaran {{kategori_1}} minggu lalu {{nominal_1}}, 4 minggu sebelumnya tidak ada.",
  anggaran_lewat: "Anggaran wajib {{kategori_1}} sudah lewat, terpakai {{persen_1}}.",
  anggaran_cepat: "Anggaran wajib {{kategori_1}} sudah terpakai {{persen_1}}, padahal bulan baru berjalan {{persen_2}}.",
  tagihan: "Tagihan {{tagihan_1}} {{nominal_1}} jatuh tempo {{tanggal_1}}.",
  total_minggu: "Total pengeluaran minggu lalu {{nominal_1}} dari {{jumlah_1}} transaksi.",
};

export function templateSentence(fact: InsightFact): string {
  return fillSentence(INSIGHT_TEMPLATES[fact.kind], factPlaceholders(fact));
}
