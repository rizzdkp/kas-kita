import { diffDaysKey } from "@/server/metrics/_time";
import type { DedupeGroup } from "./types";

// dedupe window 2 hari karena bank sering membukukan transaksi e-wallet H+1 (PRD F-IN-6 AC1)
export const DEDUPE_WINDOW_DAYS = 2;

export interface DedupeRow {
  rowHash: string;
  date: string;
  /** Bertanda: positif masuk, negatif keluar. */
  amount: bigint;
}

/** Transaksi yang sudah tercatat di akun yang sama dan belum tertaut ke baris impor. */
export interface DedupeCandidate {
  id: string;
  date: string;
  /** Bertanda dari sudut akun impor: positif masuk, negatif keluar. */
  amount: bigint;
}

export interface DedupeResult {
  group: DedupeGroup;
  matchedTransactionId: string | null;
  dayDiff: number | null;
}

/**
 * Kelompokkan baris F-IN-6 AC2. Satu transaksi pembanding hanya dipasangkan ke satu baris,
 * dipilih dari selisih tanggal terkecil; baris identik di file yang sama tidak saling menggugurkan.
 */
export function classifyRows(
  rows: ReadonlyArray<DedupeRow>,
  committedHashes: ReadonlySet<string>,
  candidates: ReadonlyArray<DedupeCandidate>,
): DedupeResult[] {
  const results: DedupeResult[] = rows.map((r) => ({
    group: committedHashes.has(r.rowHash) ? "exact_duplicate" : "new",
    matchedTransactionId: null,
    dayDiff: null,
  }));

  const pairs: Array<{ row: number; candidate: number; diff: number }> = [];
  rows.forEach((r, i) => {
    if (results[i]!.group === "exact_duplicate") return;
    candidates.forEach((c, j) => {
      if (c.amount !== r.amount) return;
      const diff = Math.abs(diffDaysKey(r.date, c.date));
      if (diff <= DEDUPE_WINDOW_DAYS) pairs.push({ row: i, candidate: j, diff });
    });
  });
  // urutan stabil: selisih terkecil dulu, lalu posisi baris, lalu posisi pembanding
  pairs.sort((a, b) => a.diff - b.diff || a.row - b.row || a.candidate - b.candidate);

  const usedCandidates = new Set<number>();
  for (const p of pairs) {
    const result = results[p.row]!;
    if (result.group !== "new" || usedCandidates.has(p.candidate)) continue;
    usedCandidates.add(p.candidate);
    results[p.row] = { group: "possible_duplicate", matchedTransactionId: candidates[p.candidate]!.id, dayDiff: p.diff };
  }
  return results;
}
