import type { ZodType } from "zod";

// kontrak klien AI (ARCHITECTURE.md bagian 5); implementasi di client.ts
export type AiPurpose = "quick_add" | "receipt" | "pdf_extract" | "insight" | "test";
export type AiModelKind = "text" | "vision";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  textModel: string | null;
  visionModel: string | null;
  supportsJsonSchema: boolean | null;
}

export type AiContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface StructuredRequest<T> {
  purpose: AiPurpose;
  kind: AiModelKind;
  system: string;
  user: string | AiContentPart[];
  /** Nama skema untuk response_format json_schema. */
  schemaName: string;
  schema: ZodType<T>;
  /** Skema JSON yang sama untuk server; dibuat dari Zod (z.toJSONSchema). */
  jsonSchema: Record<string, unknown>;
}

export type AiErrorCode =
  | "not_configured" // base URL, key, atau model belum diisi
  | "unreachable" // jaringan, timeout, DNS
  | "http_error" // server membalas non-2xx selain penolakan response_format
  | "no_vision" // model tidak menerima gambar
  | "invalid_output"; // JSON rusak atau gagal validasi setelah satu retry

export interface AiError {
  code: AiErrorCode;
  /** Siap tampil, Bahasa Indonesia (COPY.md). Tidak memuat API key atau isi prompt. */
  message: string;
  /** Pesan asli server bila ada, untuk hasil tes koneksi. */
  serverMessage?: string;
}

export type StructuredResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AiError; partial?: unknown };
