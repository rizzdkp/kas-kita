import { normalizeDescription } from "./row-hash";

// kata generik mutasi bank tidak membedakan kategori, jadi tidak ikut dicocokkan
const STOP_WORDS = new Set([
  "trsf", "transfer", "banking", "ebanking", "mbanking", "qris", "debit", "kredit", "via", "dari", "untuk",
  "pembayaran", "payment", "purchase", "trx", "transaksi", "switching", "tanggal", "the", "and",
]);

// ambang skor Dice; di bawah ini kemiripan terlalu lemah untuk disarankan
const MIN_SIMILARITY = 0.5;

export interface CategoryHistoryEntry {
  kind: "income" | "expense";
  categoryId: string;
  text: string;
}

export interface SuggestionTarget {
  kind: "income" | "expense";
  description: string;
}

export function descriptionTokens(text: string): string[] {
  const tokens = normalizeDescription(text)
    .split(" ")
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP_WORDS.has(t));
  return [...new Set(tokens)];
}

/**
 * Saran kategori dari riwayat deskripsi yang mirip (UX-FLOWS 6 langkah 5): kategori dengan total skor
 * kemiripan tertinggi di antara riwayat berjenis sama. Tanpa riwayat mirip hasilnya null ("Pilih kategori").
 */
export function suggestCategories(targets: ReadonlyArray<SuggestionTarget>, history: ReadonlyArray<CategoryHistoryEntry>): Array<string | null> {
  const entries = history.map((h) => ({ ...h, tokens: descriptionTokens(h.text) })).filter((h) => h.tokens.length > 0);
  const byToken = new Map<string, number[]>();
  entries.forEach((e, i) => {
    for (const t of e.tokens) {
      const list = byToken.get(t);
      if (list) list.push(i);
      else byToken.set(t, [i]);
    }
  });

  return targets.map((target) => {
    const tokens = descriptionTokens(target.description);
    if (tokens.length === 0) return null;
    const shared = new Map<number, number>();
    for (const t of tokens) for (const i of byToken.get(t) ?? []) shared.set(i, (shared.get(i) ?? 0) + 1);

    const scores = new Map<string, number>();
    for (const [i, count] of [...shared].sort((a, b) => a[0] - b[0])) {
      const e = entries[i]!;
      if (e.kind !== target.kind) continue;
      const dice = (2 * count) / (tokens.length + e.tokens.length);
      if (dice < MIN_SIMILARITY) continue;
      scores.set(e.categoryId, (scores.get(e.categoryId) ?? 0) + dice);
    }
    let best: string | null = null;
    let bestScore = 0;
    // riwayat diurutkan terbaru dulu, jadi pada skor sama kategori yang terakhir dipakai menang
    for (const [categoryId, score] of scores) {
      if (score > bestScore) {
        best = categoryId;
        bestScore = score;
      }
    }
    return best;
  });
}
