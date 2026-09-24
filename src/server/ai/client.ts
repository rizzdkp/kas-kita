import { decryptSecret } from "@/server/crypto";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { recordAiCall, saveJsonSchemaSupport, type AiCallEntry } from "@/server/mutations/ai-settings";
import { getAiSettingsRow } from "@/server/queries/ai-settings";
import { aiTimeouts, joinUrl, requestJson, type ChatMessage } from "./http";
import { parseOutput, readCompletion, type ParsedOutput } from "./output";
import type { AiConfig, AiError, StructuredRequest, StructuredResult } from "./types";

// Signature publik (getAiConfig, listModels, completeStructured) adalah kontrak untuk fitur AI lain; jangan diubah.

export const AI_UNREACHABLE_MESSAGE = "Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri.";
export const AI_NOT_CONFIGURED_MESSAGE = "Model AI belum dipasang. Pilih model di pengaturan AI.";
export const AI_INVALID_OUTPUT_MESSAGE = "Jawaban model AI tidak terbaca utuh. Cek hasilnya dan isi field yang kosong sendiri.";
export const noVisionMessage = (model: string) => `Model ${model} tidak bisa membaca gambar. Pilih model vision lain di pengaturan AI.`;
const httpErrorMessage = (status: number) => `Model AI menolak permintaan (HTTP ${status}). Cek pengaturan AI atau isi field yang kosong sendiri.`;

const MODELS_EMPTY = "Server tidak mengirim daftar model. Ketik ID model secara manual.";
const MODELS_UNREACHABLE = "Server AI tidak merespons. Cek base URL, atau ketik ID model secara manual.";

/** Konfigurasi rumah tangga dengan API key terdekripsi, atau null bila belum lengkap. Hanya di server. */
export async function getAiConfig(db: DbOrTx = defaultDb): Promise<AiConfig | null> {
  const row = await getAiSettingsRow(db);
  if (!row || !row.baseUrl || !row.apiKeyCiphertext) return null;
  let apiKey: string;
  try {
    apiKey = decryptSecret(row.apiKeyCiphertext);
  } catch {
    // kunci enkripsi berganti tanpa rotate-key; perlakukan seperti belum dipasang
    console.error(JSON.stringify({ level: "error", msg: "ai_key_decrypt_failed" }));
    return null;
  }
  if (!apiKey) return null;
  return {
    baseUrl: row.baseUrl,
    apiKey,
    textModel: row.textModel,
    visionModel: row.visionModel,
    supportsJsonSchema: row.supportsJsonSchema,
  };
}

function modelIdsFrom(json: unknown): string[] {
  const body = (json ?? {}) as { data?: unknown; models?: unknown };
  const list = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : Array.isArray(json) ? json : [];
  const ids = list
    .map((m: unknown) => {
      if (typeof m === "string") return m;
      const item = (m ?? {}) as { id?: unknown; name?: unknown };
      return typeof item.id === "string" ? item.id : typeof item.name === "string" ? item.name : null;
    })
    .filter((id): id is string => Boolean(id && id.trim()));
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** GET {baseUrl}/models, timeout 10 detik. */
export async function listModels(config: Pick<AiConfig, "baseUrl" | "apiKey">): Promise<{ ok: true; models: string[] } | { ok: false; message: string }> {
  const out = await requestJson(joinUrl(config.baseUrl, "/models"), { method: "GET", apiKey: config.apiKey, timeoutMs: aiTimeouts.models });
  if (out.kind === "network") return { ok: false, message: MODELS_UNREACHABLE };
  if (out.kind === "http") return { ok: false, message: `Server membalas HTTP ${out.status}: ${out.message}. Cek base URL dan API key, atau ketik ID model secara manual.` };
  const models = modelIdsFrom(out.json);
  return models.length ? { ok: true, models } : { ok: false, message: MODELS_EMPTY };
}

const STRATEGIES = ["json_schema", "json_object", "prompt"] as const;
type Strategy = (typeof STRATEGIES)[number];

type SendOutcome =
  | { kind: "response"; content: string | null; usage: Pick<AiCallEntry, "inputTokens" | "outputTokens">; latencyMs: number }
  | { kind: "rejected" }
  | { kind: "error"; error: AiError };

const FORMAT_REJECTION = /response_format|json_schema|json_object/i;
const VISION_REJECTION = /image|vision|multi-?modal/i;

function jsonInstruction(req: StructuredRequest<unknown>): string {
  return [
    "Balas hanya dengan satu objek JSON yang cocok dengan JSON Schema di bawah, tanpa teks lain dan tanpa blok kode.",
    `schema: ${req.schemaName}`,
    JSON.stringify(req.jsonSchema),
  ].join("\n");
}

function baseMessages(req: StructuredRequest<unknown>, strategy: Strategy): ChatMessage[] {
  // json_object butuh kata JSON di prompt; fallback prompt butuh baris schema: untuk server yang membaca nama skema
  const system = strategy === "json_schema" ? req.system : `${req.system}\n\n${jsonInstruction(req)}`;
  return [
    { role: "system", content: system },
    { role: "user", content: req.user },
  ];
}

function responseFormat(req: StructuredRequest<unknown>, strategy: Strategy): Record<string, unknown> | undefined {
  if (strategy === "json_schema") {
    // sebagian server menolak kata kunci $schema di dalam response_format
    const { $schema: _ignored, ...schema } = req.jsonSchema;
    return { type: "json_schema", json_schema: { name: req.schemaName, schema, strict: true } };
  }
  if (strategy === "json_object") return { type: "json_object" };
  return undefined;
}

async function safeRecord(entry: AiCallEntry, db: DbOrTx): Promise<void> {
  try {
    await recordAiCall(entry, db);
  } catch {
    // log pemakaian tidak boleh menggagalkan hasil AI
    console.error(JSON.stringify({ level: "error", msg: "ai_call_record_failed" }));
  }
}

/**
 * POST /chat/completions dengan strategi json_schema → json_object → instruksi prompt,
 * validasi Zod dan satu retry. Mencatat ai_calls (metadata saja). Timeout 30 dtk teks, 60 dtk vision.
 */
export async function completeStructured<T>(config: AiConfig, req: StructuredRequest<T>, db: DbOrTx = defaultDb): Promise<StructuredResult<T>> {
  const model = req.kind === "vision" ? config.visionModel : config.textModel;
  if (!config.baseUrl || !config.apiKey || !model) return { ok: false, error: { code: "not_configured", message: AI_NOT_CONFIGURED_MESSAGE } };

  const hasImage = Array.isArray(req.user) && req.user.some((p) => p.type === "image_url");
  const timeoutMs = req.kind === "vision" ? aiTimeouts.vision : aiTimeouts.text;
  const url = joinUrl(config.baseUrl, "/chat/completions");
  const record = (entry: Omit<AiCallEntry, "purpose" | "model">) => safeRecord({ purpose: req.purpose, model, ...entry }, db);

  async function send(strategy: Strategy, messages: ChatMessage[]): Promise<SendOutcome> {
    const started = Date.now();
    const format = responseFormat(req as StructuredRequest<unknown>, strategy);
    const out = await requestJson(url, {
      method: "POST",
      apiKey: config.apiKey,
      timeoutMs,
      body: { model, messages, temperature: 0, ...(format ? { response_format: format } : {}) },
    });
    const latencyMs = Date.now() - started;
    const meta = { inputTokens: null, outputTokens: null, latencyMs, ok: false };
    if (out.kind === "network") {
      await record({ ...meta, error: out.reason });
      return { kind: "error", error: { code: "unreachable", message: AI_UNREACHABLE_MESSAGE } };
    }
    if (out.kind === "http") {
      if (format && (out.status === 400 || out.status === 422) && FORMAT_REJECTION.test(out.message)) {
        await record({ ...meta, error: "format_rejected" });
        return { kind: "rejected" };
      }
      if (hasImage && out.status >= 400 && out.status < 500 && VISION_REJECTION.test(out.message)) {
        await record({ ...meta, error: "no_vision" });
        return { kind: "error", error: { code: "no_vision", message: noVisionMessage(model!), serverMessage: out.message } };
      }
      await record({ ...meta, error: `http_${out.status}` });
      return { kind: "error", error: { code: "http_error", message: httpErrorMessage(out.status), serverMessage: out.message } };
    }
    const { content, usage } = readCompletion(out.json);
    return { kind: "response", content, usage, latencyMs };
  }

  async function finish(outcome: Extract<SendOutcome, { kind: "response" }>): Promise<ParsedOutput<T>> {
    const parsed = parseOutput(outcome.content, req.schema);
    await record({ ...outcome.usage, latencyMs: outcome.latencyMs, ok: parsed.kind === "valid", error: parsed.kind === "valid" ? null : "invalid_output" });
    return parsed;
  }

  let index = config.supportsJsonSchema === false ? 1 : 0;
  let strategy: Strategy = STRATEGIES[index]!;
  let first: SendOutcome = await send(strategy, baseMessages(req as StructuredRequest<unknown>, strategy));
  while (first.kind === "rejected" && index < STRATEGIES.length - 1) {
    index += 1;
    strategy = STRATEGIES[index]!;
    first = await send(strategy, baseMessages(req as StructuredRequest<unknown>, strategy));
  }
  if (first.kind === "rejected") return { ok: false, error: { code: "http_error", message: httpErrorMessage(400) } };
  if (first.kind === "error") return { ok: false, error: first.error };

  const supports = strategy === "json_schema";
  if (config.supportsJsonSchema !== supports) {
    await saveJsonSchemaSupport(supports, db).catch(() => console.error(JSON.stringify({ level: "error", msg: "ai_strategy_save_failed" })));
  }

  const firstParsed = await finish(first);
  if (firstParsed.kind === "valid") return { ok: true, data: firstParsed.data };

  const retryMessages: ChatMessage[] = [
    ...baseMessages(req as StructuredRequest<unknown>, strategy),
    { role: "assistant", content: first.content ?? "" },
    {
      role: "user",
      content: `Balasan sebelumnya tidak cocok dengan skema: ${firstParsed.issues} Kirim ulang satu objek JSON lengkap yang cocok dengan skema, tanpa teks lain.`,
    },
  ];
  const second = await send(strategy, retryMessages);
  const firstPartial = firstParsed.kind === "invalid" ? firstParsed.raw : undefined;
  if (second.kind !== "response") {
    const error = second.kind === "error" ? second.error : { code: "http_error" as const, message: httpErrorMessage(400) };
    return { ok: false, error, partial: firstPartial };
  }
  const secondParsed = await finish(second);
  if (secondParsed.kind === "valid") return { ok: true, data: secondParsed.data };
  const partial = secondParsed.kind === "invalid" && isObject(secondParsed.raw) ? secondParsed.raw : firstPartial;
  return { ok: false, error: { code: "invalid_output", message: AI_INVALID_OUTPUT_MESSAGE }, partial };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
