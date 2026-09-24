import type { ZodType } from "zod";

export type ParsedOutput<T> =
  | { kind: "valid"; data: T; raw: unknown }
  | { kind: "invalid"; raw: unknown; issues: string }
  | { kind: "unparseable"; issues: string };

type Usage = { inputTokens: number | null; outputTokens: number | null };

function toInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/** Isi teks jawaban dari choices[0].message.content (string atau array bagian teks). */
export function readCompletion(json: unknown): { content: string | null; usage: Usage } {
  const body = (json ?? {}) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: Record<string, unknown> };
  const raw = body.choices?.[0]?.message?.content;
  let content: string | null = null;
  if (typeof raw === "string") content = raw;
  else if (Array.isArray(raw)) {
    content = raw
      .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("");
  }
  const usage = { inputTokens: toInt(body.usage?.prompt_tokens), outputTokens: toInt(body.usage?.completion_tokens) };
  return { content, usage };
}

/** Ambil JSON dari balasan model: buang ```json fences dan teks di luar objek terluar. */
export function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    throw new SyntaxError("Tidak ada objek JSON");
  }
}

const MAX_ISSUES = 10;

export function parseOutput<T>(content: string | null, schema: ZodType<T>): ParsedOutput<T> {
  if (content === null || content.trim() === "") return { kind: "unparseable", issues: "Balasan kosong." };
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch {
    return { kind: "unparseable", issues: "Balasan bukan JSON yang valid." };
  }
  const result = schema.safeParse(raw);
  if (result.success) return { kind: "valid", data: result.data, raw };
  const issues = result.error.issues
    .slice(0, MAX_ISSUES)
    .map((i) => `${i.path.length ? i.path.join(".") : "(akar)"}: ${i.message}`)
    .join("; ");
  return { kind: "invalid", raw, issues };
}
