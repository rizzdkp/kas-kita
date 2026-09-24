import type { Scope } from "@/lib/scope";
import { todayJakarta, toJakarta } from "@/lib/dates";
import { AI_UNAVAILABLE_MESSAGE, mapAiOutput, type AiLineFields } from "@/components/quick-add/ai-merge";
import { orderAccountsForScope } from "@/components/quick-add/preview-model";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { getQuickAddContext } from "@/server/queries/quick-add-context";
import { completeStructured, getAiConfig } from "../client";
import type { AiErrorCode } from "../types";
import { buildQuickAddPrompt } from "../prompts/quick-add-v1";
import { QUICK_ADD_SCHEMA_NAME, quickAddAiJsonSchema, quickAddAiSchema } from "../schemas/quick-add";

export type QuickAddAiResolveResult =
  | { ok: true; data: Array<AiLineFields | null> }
  | { ok: false; code: AiErrorCode; error: string };

/**
 * F-IN-2 AC2: baris yang belum lengkap dibaca model teks, lalu nama akun/kategori dipetakan kembali ke id
 * dari konteks server. Tidak menulis apa pun selain metadata ai_calls lewat client.
 */
export async function resolveQuickAddLines(
  viewer: Viewer,
  lines: string[],
  scope: Scope,
  db: DbOrTx = defaultDb,
  now: Date = new Date(),
): Promise<QuickAddAiResolveResult> {
  const config = await getAiConfig(db);
  if (!config || !config.textModel) return { ok: false, code: "not_configured", error: AI_UNAVAILABLE_MESSAGE };

  const ctx = await getQuickAddContext(viewer, db);
  const { system, user } = buildQuickAddPrompt({
    ctx: { ...ctx, accounts: orderAccountsForScope(ctx.accounts, scope) },
    today: todayJakarta(now),
    weekday: toJakarta(now).getDay(),
    lines,
  });
  const result = await completeStructured(
    config,
    {
      purpose: "quick_add",
      kind: "text",
      system,
      user,
      schemaName: QUICK_ADD_SCHEMA_NAME,
      schema: quickAddAiSchema,
      jsonSchema: quickAddAiJsonSchema,
    },
    db,
  );
  if (result.ok) return { ok: true, data: mapAiOutput(result.data.items, lines.length, ctx, now) };

  // hasil parsial yang masih lolos skema tetap dipakai; sisanya tampil sebagai field kosong
  const partial = result.partial === undefined ? null : quickAddAiSchema.safeParse(result.partial);
  if (partial?.success && partial.data.items.length > 0) {
    return { ok: true, data: mapAiOutput(partial.data.items, lines.length, ctx, now) };
  }
  return { ok: false, code: result.error.code, error: result.error.message || AI_UNAVAILABLE_MESSAGE };
}
