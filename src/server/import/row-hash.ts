import { createHash } from "node:crypto";

// nomor referensi bank (>= 6 digit) berbeda antar unduhan untuk transaksi yang sama, jadi tidak ikut hash
const REFERENCE_NUMBER = /\d{6,}/g;

/** Deskripsi untuk hash dan pencocokan: huruf kecil, tanpa nomor referensi, tanda baca jadi spasi, spasi tunggal. */
export function normalizeDescription(description: string): string {
  return description
    .normalize("NFKC")
    .toLowerCase()
    .replace(REFERENCE_NUMBER, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RowHashInput {
  institutionId: string | null;
  accountId: string;
  date: string;
  normalizedDescription: string;
  amount: bigint;
  /** Urutan kemunculan baris identik di file yang sama, mulai 1. */
  occurrence: number;
}

/**
 * sha256(institusi, akun, tanggal, deskripsi ternormalisasi, nominal bertanda, urutan kemunculan).
 * Urutan kemunculan membuat dua transaksi identik di satu file tetap dua baris, dan file ulang tetap terdeteksi.
 */
export function computeRowHash(input: RowHashInput): string {
  const payload = JSON.stringify([
    input.institutionId ?? "",
    input.accountId,
    input.date,
    input.normalizedDescription,
    input.amount.toString(),
    input.occurrence,
  ]);
  return createHash("sha256").update(payload).digest("hex");
}

/** Hash untuk semua baris file; baris identik mendapat urutan 1, 2, 3 sesuai posisi di file. */
export function computeRowHashes(
  base: { institutionId: string | null; accountId: string },
  rows: ReadonlyArray<{ date: string; normalizedDescription: string; amount: bigint }>,
): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const key = `${r.date}\u0000${r.normalizedDescription}\u0000${r.amount}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return computeRowHash({ ...base, ...r, occurrence });
  });
}
