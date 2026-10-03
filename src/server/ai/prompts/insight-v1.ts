import type { InsightFactKind } from "@/server/insights/facts";
import type { Placeholders } from "@/server/insights/placeholders";
import { INSIGHT_SCHEMA_NAME } from "../schemas/insight";

export const INSIGHT_PROMPT_VERSION = "insight-v1";

const MEANING: Record<InsightFactKind, string> = {
  kategori_naik: "pengeluaran satu kategori minggu lalu naik dibanding rata-rata mingguan sebelumnya",
  kategori_baru: "ada pengeluaran di satu kategori minggu lalu, padahal minggu-minggu sebelumnya tidak ada",
  anggaran_lewat: "anggaran wajib satu kategori bulan ini sudah melewati batas",
  anggaran_cepat: "anggaran wajib satu kategori terpakai lebih cepat dari hari yang sudah berjalan",
  tagihan: "satu tagihan jatuh tempo minggu ini",
  total_minggu: "total pengeluaran minggu lalu",
};

export interface InsightPromptFact {
  kind: InsightFactKind;
  placeholders: Placeholders;
}

/**
 * Prompt wawasan F-AI-2: model hanya merangkai kalimat. Nilai fakta tidak dikirim;
 * model hanya melihat nama placeholder, dan kode yang menyisipkan angkanya (AC2).
 */
export function buildInsightPrompt(facts: InsightPromptFact[]): { system: string; user: string } {
  const system = [
    "Kamu menulis kalimat wawasan keuangan mingguan untuk aplikasi pencatatan keuangan rumah tangga.",
    `schema: ${INSIGHT_SCHEMA_NAME}`,
    "",
    "Aturan:",
    "- Kembalikan JSON {\"kalimat\": [{\"id\": ..., \"teks\": ...}]} dengan tepat satu kalimat untuk setiap fakta.",
    "- id: salin persis id fakta.",
    "- Kamu tidak tahu nilainya. Tulis setiap nominal, persen, jumlah, tanggal, nama kategori, dan nama tagihan hanya sebagai placeholder persis seperti di daftar, misalnya {{nominal_1}}.",
    "- Semua placeholder wajib harus dipakai. Jangan membuat placeholder baru.",
    "- Jangan menulis angka, digit, kata bilangan (satu, dua, ribu, juta, persen), simbol %, atau Rp di luar placeholder.",
    "- Bahasa Indonesia sehari-hari yang rapi dan netral, satu kalimat pendek, diakhiri titik.",
    "- Tanpa sapaan, tanpa emoji, tanpa tanda seru, tanpa kalimat penyemangat, tanpa saran yang tidak diminta.",
    "- Sebut minggu yang dirangkum sebagai \"minggu lalu\".",
  ].join("\n");
  const user = [
    "Fakta:",
    ...facts.map((f) => {
      const specs = Object.entries(f.placeholders)
        .map(([name, spec]) => `  - {{${name}}}: ${spec.description}${spec.required ? " (wajib)" : " (boleh dipakai)"}`)
        .join("\n");
      return `- id: ${f.kind}\n  arti: ${MEANING[f.kind]}\n  placeholder:\n${specs}`;
    }),
  ].join("\n");
  return { system, user };
}
