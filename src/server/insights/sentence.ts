import type { Placeholders } from "./placeholders";

export const MAX_SENTENCE_LENGTH = 240;

const PLACEHOLDER = /\{\{\s*([a-z]+_\d+)\s*\}\}/g;

// kata bilangan dan satuan juga angka: hanya boleh datang dari placeholder (F-AI-2 AC2)
const NUMBER_WORDS = [
  "nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas",
  "seratus", "seribu", "sejuta", "setengah", "separuh", "seperempat", "belas", "puluh", "puluhan", "ratus", "ratusan",
  "ribu", "ribuan", "juta", "jutaan", "miliar", "triliun", "persen", "rupiah", "rp", "idr", "rb", "jt", "lipat",
];
const NUMBER_WORD = new RegExp(`(?<!\\p{L})(${NUMBER_WORDS.join("|")})(?!\\p{L})`, "iu");
// COPY.md bagian 1: tanpa sapaan berlebihan
const GREETING = /(?<!\p{L})(halo|hai|hi|bos|boss|kak|sobat|guys|yuk)(?!\p{L})/iu;

export type SentenceRejection =
  | "kosong"
  | "terlalu_panjang"
  | "placeholder_tidak_dikenal"
  | "placeholder_wajib_hilang"
  | "angka_liar"
  | "kata_bilangan"
  | "tanda_terlarang"
  | "sapaan";

export type SentenceCheck = { ok: true } | { ok: false; reason: SentenceRejection };

/** Kalimat AI hanya diterima kalau semua angka lewat placeholder fakta itu dan semua placeholder wajib dipakai. */
export function validateSentence(text: string, placeholders: Placeholders): SentenceCheck {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "kosong" };
  if (trimmed.length > MAX_SENTENCE_LENGTH) return { ok: false, reason: "terlalu_panjang" };

  const used = new Set<string>();
  for (const m of trimmed.matchAll(PLACEHOLDER)) {
    const name = m[1]!;
    if (!(name in placeholders)) return { ok: false, reason: "placeholder_tidak_dikenal" };
    used.add(name);
  }
  for (const [name, spec] of Object.entries(placeholders)) {
    if (spec.required && !used.has(name)) return { ok: false, reason: "placeholder_wajib_hilang" };
  }

  const rest = trimmed.replace(PLACEHOLDER, " ");
  if (/[{}]/.test(rest)) return { ok: false, reason: "placeholder_tidak_dikenal" };
  if (/\p{N}|%/u.test(rest)) return { ok: false, reason: "angka_liar" };
  if (NUMBER_WORD.test(rest)) return { ok: false, reason: "kata_bilangan" };
  if (/[!\n\r]|\p{Extended_Pictographic}/u.test(rest)) return { ok: false, reason: "tanda_terlarang" };
  if (GREETING.test(rest)) return { ok: false, reason: "sapaan" };
  return { ok: true };
}

/** Menyisipkan nilai terformat; dipanggil hanya setelah validateSentence lolos atau untuk templat kode. */
export function fillSentence(text: string, placeholders: Placeholders): string {
  return text.trim().replace(PLACEHOLDER, (whole, name: string) => placeholders[name]?.value ?? whole);
}
