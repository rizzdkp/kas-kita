import type { CollectedFact, InsightFactKind } from "./facts";
import { factPlaceholders } from "./placeholders";
import { fillSentence, validateSentence, type SentenceRejection } from "./sentence";
import { templateSentence } from "./templates";

export interface ComposedInsight extends CollectedFact {
  text: string;
  generatedBy: "ai" | "template";
  /** Alasan kalimat AI ditolak; hanya untuk tes dan log metadata. */
  rejected?: SentenceRejection | "tidak_ada";
}

/** Mengembalikan kalimat ber-placeholder per jenis fakta, atau null kalau AI tidak tersedia atau gagal. */
export type InsightWriter = (facts: CollectedFact[]) => Promise<Map<string, string> | null>;

/** Kalimat AI yang lolos validasi dipakai; selainnya jatuh ke templat untuk wawasan itu saja. */
export async function composeInsights(facts: CollectedFact[], writer: InsightWriter | null): Promise<ComposedInsight[]> {
  if (facts.length === 0) return [];
  let sentences: Map<string, string> | null = null;
  if (writer) {
    try {
      sentences = await writer(facts);
    } catch {
      // AI gagal tidak boleh menggagalkan wawasan; templat selalu tersedia
      sentences = null;
    }
  }
  return facts.map((f) => {
    const kind: InsightFactKind = f.fact.kind;
    const fallback = { ...f, text: templateSentence(f.fact), generatedBy: "template" as const };
    if (!sentences) return fallback;
    const raw = sentences.get(kind);
    if (raw === undefined) return { ...fallback, rejected: "tidak_ada" as const };
    const placeholders = factPlaceholders(f.fact);
    const check = validateSentence(raw, placeholders);
    if (!check.ok) return { ...fallback, rejected: check.reason };
    return { ...f, text: fillSentence(raw, placeholders), generatedBy: "ai" as const };
  });
}
