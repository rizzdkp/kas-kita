import { asc, eq } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { aiSettings, users } from "@/server/db/schema";

export type AiSettingsRow = typeof aiSettings.$inferSelect;

/** Yang boleh sampai ke browser: tanpa ciphertext, key hanya 4 karakter terakhir (F-AI-1 AC3). */
export interface AiSettingsView {
  id: string;
  version: number;
  baseUrl: string;
  apiKeyLast4: string | null;
  textModel: string | null;
  visionModel: string | null;
  supportsJsonSchema: boolean | null;
  lastTestedAt: Date | null;
  updatedAt: Date;
  updatedByName: string | null;
}

/** Satu baris rumah tangga beserta ciphertext; hanya untuk klien AI dan mutasi di server. */
export async function getAiSettingsRow(db: DbOrTx = defaultDb): Promise<AiSettingsRow | null> {
  const [row] = await db.select().from(aiSettings).orderBy(asc(aiSettings.createdAt)).limit(1);
  return row ?? null;
}

export async function getAiSettingsView(db: DbOrTx = defaultDb): Promise<AiSettingsView | null> {
  const [row] = await db
    .select({
      id: aiSettings.id,
      version: aiSettings.version,
      baseUrl: aiSettings.baseUrl,
      apiKeyLast4: aiSettings.apiKeyLast4,
      textModel: aiSettings.textModel,
      visionModel: aiSettings.visionModel,
      supportsJsonSchema: aiSettings.supportsJsonSchema,
      lastTestedAt: aiSettings.lastTestedAt,
      updatedAt: aiSettings.updatedAt,
      updatedByName: users.displayName,
    })
    .from(aiSettings)
    .leftJoin(users, eq(users.id, aiSettings.updatedBy))
    .orderBy(asc(aiSettings.createdAt))
    .limit(1);
  return row ?? null;
}
