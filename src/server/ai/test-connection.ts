import sharp from "sharp";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { completeStructured } from "./client";
import {
  TEST_CONNECTION_SCHEMA_NAME,
  TEST_CONNECTION_SYSTEM,
  TEST_CONNECTION_TEXT_PROMPT,
  TEST_CONNECTION_VISION_PROMPT,
  testConnectionJsonSchema,
  testConnectionSchema,
} from "./prompts/test-connection-v1";
import type { TestConnectionOutput } from "./prompts/test-connection-v1";
import type { AiConfig, AiErrorCode, AiModelKind, StructuredRequest, StructuredResult } from "./types";

export type ConnectionStatus = "ok" | "failed" | "no_vision" | "skipped";

/** Hasil tes per model; aman dikirim ke browser (tanpa key, prompt, atau isi jawaban). */
export interface ConnectionCheck {
  kind: AiModelKind;
  model: string | null;
  status: ConnectionStatus;
  message: string;
  serverMessage?: string;
}

let sampleImage: Promise<string> | null = null;

/** Gambar contoh 32x32 dibuat lokal supaya tes vision tidak bergantung pada internet. */
export function sampleImageDataUrl(): Promise<string> {
  sampleImage ??= sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 13, g: 148, b: 136 } } })
    .png()
    .toBuffer()
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`);
  return sampleImage;
}

const FAILURE_MESSAGE: Record<Exclude<AiErrorCode, "no_vision">, string> = {
  not_configured: "Model belum dipilih.",
  unreachable: "Tidak merespons. Cek base URL dan pastikan server AI menyala.",
  http_error: "Server menolak permintaan.",
  invalid_output: "Merespons, tetapi jawabannya bukan JSON yang sesuai. Coba model lain.",
};

function toCheck(kind: AiModelKind, model: string | null, result: StructuredResult<TestConnectionOutput> | null): ConnectionCheck {
  if (!model || !result) return { kind, model: null, status: "skipped", message: "Model belum dipilih." };
  if (result.ok) return { kind, model, status: "ok", message: "Merespons" };
  const { code, serverMessage } = result.error;
  if (code === "no_vision") return { kind, model, status: "no_vision", message: "Model tidak mendukung gambar.", serverMessage };
  return { kind, model, status: "failed", message: FAILURE_MESSAGE[code], serverMessage };
}

/** F-AI-1 AC2: satu prompt teks ke model teks dan satu gambar contoh ke model vision. */
export async function testAiConnection(config: AiConfig, db: DbOrTx = defaultDb): Promise<ConnectionCheck[]> {
  const base = {
    purpose: "test" as const,
    system: TEST_CONNECTION_SYSTEM,
    schemaName: TEST_CONNECTION_SCHEMA_NAME,
    schema: testConnectionSchema,
    jsonSchema: testConnectionJsonSchema,
  };
  const textReq: StructuredRequest<TestConnectionOutput> = { ...base, kind: "text", user: TEST_CONNECTION_TEXT_PROMPT };
  const visionReq: StructuredRequest<TestConnectionOutput> = {
    ...base,
    kind: "vision",
    user: [
      { type: "text", text: TEST_CONNECTION_VISION_PROMPT },
      { type: "image_url", image_url: { url: await sampleImageDataUrl() } },
    ],
  };
  const [text, vision] = await Promise.all([
    config.textModel ? completeStructured(config, textReq, db) : null,
    config.visionModel ? completeStructured(config, visionReq, db) : null,
  ]);
  return [toCheck("text", config.textModel, text), toCheck("vision", config.visionModel, vision)];
}
