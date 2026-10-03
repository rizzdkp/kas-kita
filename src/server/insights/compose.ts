import { completeStructured, getAiConfig } from "@/server/ai/client";
import { buildInsightPrompt } from "@/server/ai/prompts/insight-v1";
import { INSIGHT_SCHEMA_NAME, insightAiJsonSchema, insightAiSchema } from "@/server/ai/schemas/insight";
import type { AiConfig } from "@/server/ai/types";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
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

/** Penulis kalimat lewat klien AI; satu panggilan per cakupan. */
export function aiInsightWriter(config: AiConfig, db: DbOrTx = defaultDb): InsightWriter {
  return async (facts) => {
    const prompt = buildInsightPrompt(facts.map((f) => ({ kind: f.fact.kind, placeholders: factPlaceholders(f.fact) })));
    const result = await completeStructured(
      config,
      {
        purpose: "insight",
        kind: "text",
        system: prompt.system,
        user: prompt.user,
        schemaName: INSIGHT_SCHEMA_NAME,
        schema: insightAiSchema,
        jsonSchema: insightAiJsonSchema,
      },
      db,
    );
    if (!result.ok) return null;
    const out = new Map<string, string>();
    for (const s of result.data.kalimat) if (!out.has(s.id)) out.set(s.id, s.teks);
    return out;
  };
}

/** Penulis AI kalau pengaturan AI lengkap; null berarti semua wawasan memakai templat (AC4). */
export async function loadInsightWriter(db: DbOrTx = defaultDb): Promise<InsightWriter | null> {
  const config = await getAiConfig(db);
  if (!config?.textModel) return null;
  return aiInsightWriter(config, db);
}

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
