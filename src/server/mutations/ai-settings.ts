import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { encryptSecret } from "@/server/crypto";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { aiCalls, aiSettings } from "@/server/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { getAiSettingsRow, type AiSettingsRow } from "@/server/queries/ai-settings";
import type { AiPurpose } from "@/server/ai/types";
import { computeDiff, writeAudit, type AuditDiff } from "./audit";
import { inTransaction, parseInput } from "./_shared";

const ENTITY = "ai_settings";
// kolom rahasia tidak pernah masuk audit; perubahannya dicatat sebagai api_key ••••last4
const SECRET_COLUMNS = ["api_key_ciphertext", "api_key_last4"] as const;

export const BASE_URL_MESSAGE = "Isi base URL yang diawali http:// atau https://, misalnya https://api.openai.com/v1";
export const API_KEY_MESSAGE = "Isi API key dari penyedia AI";

const baseUrlSchema = z
  .string()
  .trim()
  .min(1, BASE_URL_MESSAGE)
  .refine((v) => {
    try {
      const url = new URL(v);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, BASE_URL_MESSAGE)
  .transform((v) => v.replace(/\/+$/, ""));

const modelSchema = z
  .string()
  .trim()
  .max(200, "ID model maksimal 200 karakter")
  .nullish()
  .transform((v) => (v ? v : null));

const saveSchema = z.object({
  baseUrl: baseUrlSchema,
  /** Kosong saat mengubah = pertahankan key lama. */
  apiKey: z.string().trim().max(1000, "API key terlalu panjang").optional().default(""),
  textModel: modelSchema,
  visionModel: modelSchema,
  /** Versi yang dilihat di form; null bila form dibuka saat belum ada pengaturan. */
  version: z.number().int().positive().nullable(),
});
export type SaveAiSettingsInput = z.input<typeof saveSchema>;

export function maskLast4(last4: string | null | undefined): string | null {
  return last4 ? `••••${last4}` : null;
}

function safeDiff(before: AiSettingsRow | null, after: AiSettingsRow | null): AuditDiff {
  const diff = computeDiff(aiSettings, before, after ?? ({} as Record<string, unknown>));
  for (const col of SECRET_COLUMNS) delete diff[col];
  const keyBefore = maskLast4(before?.apiKeyLast4);
  const keyAfter = maskLast4(after?.apiKeyLast4);
  const keyChanged = before?.apiKeyCiphertext && after?.apiKeyCiphertext ? !before.apiKeyCiphertext.equals(after.apiKeyCiphertext) : Boolean(before?.apiKeyCiphertext) !== Boolean(after?.apiKeyCiphertext);
  if (keyChanged) diff.api_key = [keyBefore, keyAfter];
  return diff;
}

async function lockRow(tx: Tx): Promise<AiSettingsRow | null> {
  const current = await getAiSettingsRow(tx);
  if (!current) return null;
  const [locked] = await tx.select().from(aiSettings).where(eq(aiSettings.id, current.id)).for("update");
  return locked ?? null;
}

function conflictFor(row: AiSettingsRow): ConflictError<{ version: number }> {
  return new ConflictError({ entity: ENTITY, latest: { version: row.version }, updatedByName: null, updatedAt: row.updatedAt });
}

/** Simpan pengaturan AI rumah tangga (F-AI-1 AC4): satu baris, versi, audit tanpa isi key. */
export async function saveAiSettings(viewer: Viewer, input: SaveAiSettingsInput, db: DbOrTx = defaultDb): Promise<AiSettingsRow> {
  const data = parseInput(saveSchema, input);
  return inTransaction(db, async (tx) => {
    const current = await lockRow(tx);
    if (current && data.version !== current.version) throw conflictFor(current);
    const secret = data.apiKey ? { apiKeyCiphertext: encryptSecret(data.apiKey), apiKeyLast4: data.apiKey.slice(-4) } : {};

    if (!current) {
      if (!data.apiKey) throw new ValidationError(API_KEY_MESSAGE, { apiKey: [API_KEY_MESSAGE] });
      const [row] = await tx
        .insert(aiSettings)
        .values({ baseUrl: data.baseUrl, textModel: data.textModel, visionModel: data.visionModel, updatedBy: viewer.user.id, ...secret })
        .returning();
      await writeAudit(tx, { actorId: viewer.user.id, entity: ENTITY, entityId: row!.id, action: "insert", diff: safeDiff(null, row!) });
      return row!;
    }

    // hasil deteksi response_format berlaku untuk server dan model tertentu saja
    const endpointChanged = data.baseUrl !== current.baseUrl || data.textModel !== current.textModel || data.visionModel !== current.visionModel;
    const [after] = await tx
      .update(aiSettings)
      .set({
        baseUrl: data.baseUrl,
        textModel: data.textModel,
        visionModel: data.visionModel,
        ...secret,
        ...(endpointChanged ? { supportsJsonSchema: null } : {}),
        updatedBy: viewer.user.id,
        updatedAt: new Date(),
        version: current.version + 1,
      })
      .where(eq(aiSettings.id, current.id))
      .returning();
    const diff = safeDiff(current, after!);
    if (Object.keys(diff).length > 0) {
      await writeAudit(tx, { actorId: viewer.user.id, entity: ENTITY, entityId: current.id, action: "update", diff });
    }
    return after!;
  });
}

/** Matikan AI sepenuhnya (SECURITY 5): baris dihapus, riwayat tetap mencatatnya. */
export async function deleteAiSettings(viewer: Viewer, input: { version: number }, db: DbOrTx = defaultDb): Promise<void> {
  const { version } = parseInput(z.object({ version: z.number().int().positive() }), input);
  await inTransaction(db, async (tx) => {
    const current = await lockRow(tx);
    if (!current) throw new NotFoundError(ENTITY, "-");
    if (current.version !== version) throw conflictFor(current);
    await tx.delete(aiSettings).where(eq(aiSettings.id, current.id));
    await writeAudit(tx, { actorId: viewer.user.id, entity: ENTITY, entityId: current.id, action: "delete", diff: safeDiff(current, null) });
  });
}

/** Hasil deteksi strategi output terstruktur (ARCHITECTURE 5); metadata sistem, bukan perubahan pengguna. */
export async function saveJsonSchemaSupport(value: boolean, db: DbOrTx = defaultDb): Promise<void> {
  await db.update(aiSettings).set({ supportsJsonSchema: value });
}

export async function markAiTested(at: Date = new Date(), db: DbOrTx = defaultDb): Promise<void> {
  await db.update(aiSettings).set({ lastTestedAt: at });
}

export interface AiCallEntry {
  purpose: AiPurpose;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  ok: boolean;
  /** Kode singkat, tidak pernah isi prompt atau respons. */
  error: string | null;
}

export async function recordAiCall(entry: AiCallEntry, db: DbOrTx = defaultDb): Promise<void> {
  await db.insert(aiCalls).values(entry);
}
