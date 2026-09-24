"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { getAiConfig, listModels } from "@/server/ai/client";
import { testAiConnection, type ConnectionCheck } from "@/server/ai/test-connection";
import { ValidationError } from "@/server/errors";
import { parseInput } from "@/server/mutations/_shared";
import { API_KEY_MESSAGE, BASE_URL_MESSAGE, deleteAiSettings, markAiTested, saveAiSettings, type SaveAiSettingsInput } from "@/server/mutations/ai-settings";
import { runAction, toActionError, type ActionResult } from "./result";

export type SavedAiSettings = { version: number; apiKeyLast4: string | null };

export async function saveAiSettingsAction(input: SaveAiSettingsInput): Promise<ActionResult<SavedAiSettings>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await saveAiSettings(viewer, input);
    return { version: row.version, apiKeyLast4: row.apiKeyLast4 };
  });
}

export async function deleteAiSettingsAction(input: { version: number }): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteAiSettings(viewer, input);
  });
}

const endpointSchema = z.object({
  baseUrl: z.string().trim().url(BASE_URL_MESSAGE),
  apiKey: z.string().trim().optional().default(""),
});

const connectionSchema = endpointSchema.extend({
  textModel: z.string().trim().optional().default(""),
  visionModel: z.string().trim().optional().default(""),
});

/** Key dari form, atau key tersimpan bila field dikosongkan; key tidak pernah dikirim balik ke browser. */
async function resolveEndpoint(input: z.output<typeof endpointSchema>): Promise<{ baseUrl: string; apiKey: string }> {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  if (input.apiKey) return { baseUrl, apiKey: input.apiKey };
  const saved = await getAiConfig();
  if (!saved) throw new ValidationError(API_KEY_MESSAGE, { apiKey: [API_KEY_MESSAGE] });
  return { baseUrl, apiKey: saved.apiKey };
}

export type ModelListResult = { ok: true; models: string[] } | { ok: false; message: string };

// tanpa runAction: mengambil daftar model tidak mengubah data, jadi halaman tidak perlu disegarkan
export async function fetchAiModelsAction(input: z.input<typeof endpointSchema>): Promise<ActionResult<ModelListResult>> {
  try {
    await requireViewer();
    const endpoint = await resolveEndpoint(parseInput(endpointSchema, input));
    return { ok: true, data: await listModels(endpoint) };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return toActionError(e);
  }
}

export async function testAiConnectionAction(input: z.input<typeof connectionSchema>): Promise<ActionResult<{ checks: ConnectionCheck[] }>> {
  return runAction(async () => {
    await requireViewer();
    const data = parseInput(connectionSchema, input);
    const endpoint = await resolveEndpoint(data);
    const saved = await getAiConfig();
    const sameEndpoint = saved?.baseUrl === endpoint.baseUrl;
    const checks = await testAiConnection({
      ...endpoint,
      textModel: data.textModel || null,
      visionModel: data.visionModel || null,
      // deteksi strategi hanya dipakai ulang untuk server yang sama
      supportsJsonSchema: sameEndpoint && saved?.textModel === (data.textModel || null) ? saved.supportsJsonSchema : null,
    });
    if (sameEndpoint) await markAiTested();
    return { checks };
  });
}
