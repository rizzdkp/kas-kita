import type { DbOrTx } from "@/server/db/client";
import type { AiConfig, StructuredRequest, StructuredResult } from "./types";

// KONTRAK SEMENTARA: agen AI inti mengganti isi file ini dengan implementasi sungguhan.
// Signature publik di bawah tidak boleh berubah tanpa memberi tahu koordinator.

/** Konfigurasi rumah tangga dengan API key terdekripsi, atau null bila belum lengkap. Hanya di server. */
export async function getAiConfig(_db?: DbOrTx): Promise<AiConfig | null> {
  return null;
}

/** GET {baseUrl}/models, timeout 10 detik. */
export async function listModels(_config: Pick<AiConfig, "baseUrl" | "apiKey">): Promise<{ ok: true; models: string[] } | { ok: false; message: string }> {
  return { ok: false, message: "Belum diimplementasikan" };
}

/**
 * POST /chat/completions dengan strategi json_schema → json_object → instruksi prompt,
 * validasi Zod dan satu retry. Mencatat ai_calls (metadata saja). Timeout 30 dtk teks, 60 dtk vision.
 */
export async function completeStructured<T>(_config: AiConfig, _req: StructuredRequest<T>, _db?: DbOrTx): Promise<StructuredResult<T>> {
  return { ok: false, error: { code: "not_configured", message: "Model AI belum dipasang." } };
}
