import { completeStructured, getAiConfig } from "@/server/ai/client";
import { buildInsightPrompt } from "@/server/ai/prompts/insight-v1";
import { INSIGHT_SCHEMA_NAME, insightAiJsonSchema, insightAiSchema } from "@/server/ai/schemas/insight";
import type { AiConfig } from "@/server/ai/types";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import type { InsightWriter } from "./compose";
import { factPlaceholders } from "./placeholders";

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
