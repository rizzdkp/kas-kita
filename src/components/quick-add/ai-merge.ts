import { dateKey, parseDateKey } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import { extractDate, occurredAtFor, type QuickAddToken } from "@/lib/quick-add-dates";
import { parseQuickAdd, type QuickAddContext, type QuickAddDraft, type QuickAddKind } from "@/lib/quick-add-parser";
import type { QuickAddAiLineOutput } from "@/server/ai/schemas/quick-add";
import type { AiField, Party, PreviewItem, QuickAddContextData } from "./types";

export const AI_UNAVAILABLE_MESSAGE = "Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri.";

/** Field hasil AI yang sudah dipetakan ke id dan divalidasi ulang; null berarti AI tidak memberi nilai yang sah. */
export interface AiLineFields {
  kind: QuickAddKind | null;
  amount: bigint | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: Date | null;
  note: string | null;
  recipient: Party | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Nominal dari model lewat parser uang yang sama dengan input manual; bukan bilangan bulat positif berarti kosong. */
export function resolveAiAmount(value: number | string | null): bigint | null {
  if (value === null) return null;
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? BigInt(value) : null;
  const parsed = parseAmount(value);
  return parsed !== null && parsed > 0n ? parsed : null;
}

/** Tanggal ISO atau kata relatif, dengan jam saat ini; tanggal setelah hari ini ditolak. */
export function resolveAiDate(value: string | null, now: Date): Date | null {
  if (!value) return null;
  const text = value.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  let at: Date | null = null;
  if (iso) {
    const day = parseDateKey(iso[1]!);
    if (!day) return null;
    at = occurredAtFor({ day: { year: day.getFullYear(), month: day.getMonth(), date: day.getDate() } }, now);
  } else {
    const tokens: QuickAddToken[] = text.split(/\s+/).map((raw) => ({ raw, norm: raw.toLowerCase(), used: false }));
    const match = extractDate(tokens, now);
    if (!match) return null;
    at = occurredAtFor(match, now);
  }
  return dateKey(at) > dateKey(now) ? null : at;
}

const RECIPIENT: Record<NonNullable<QuickAddAiLineOutput["beneficiary"]>, Party> = {
  writer: "me",
  partner: "partner",
  shared: "shared",
};

/** Satu baris jawaban model menjadi field ber-id; nama di luar daftar konteks dianggap kosong (ARCHITECTURE 5). */
export function mapAiLine(line: QuickAddAiLineOutput, ctx: QuickAddContextData, now: Date): AiLineFields {
  const accountByName = (name: string | null) =>
    name ? (ctx.accounts.find((a) => norm(a.name) === norm(name))?.id ?? null) : null;
  const kind = line.kind;
  const category = line.categoryName
    ? ctx.categories.find((c) => norm(c.name) === norm(line.categoryName!) && (kind === null || c.kind === kind))
    : undefined;
  const accountId = accountByName(line.accountName);
  const toAccountId = kind === "transfer" || kind === null ? accountByName(line.toAccountName) : null;
  const note = line.note?.trim() ? line.note.trim().slice(0, 500) : null;
  return {
    kind,
    amount: resolveAiAmount(line.amount),
    accountId,
    toAccountId: toAccountId !== accountId ? toAccountId : null,
    categoryId: kind === "transfer" ? null : (category?.id ?? null),
    occurredAt: resolveAiDate(line.date, now),
    note,
    recipient: line.beneficiary ? (RECIPIENT[line.beneficiary] ?? null) : null,
  };
}

/** Jawaban model per nomor baris (1-based) menjadi array sepanjang input; baris yang tidak dijawab berisi null. */
export function mapAiOutput(
  items: QuickAddAiLineOutput[],
  lineCount: number,
  ctx: QuickAddContextData,
  now: Date,
): Array<AiLineFields | null> {
  const out: Array<AiLineFields | null> = Array.from({ length: lineCount }, () => null);
  for (const item of items) {
    const idx = item.line - 1;
    if (idx < 0 || idx >= lineCount || out[idx]) continue;
    out[idx] = mapAiLine(item, ctx, now);
  }
  return out;
}

export interface ParserFacts {
  /** Akun disebut di teks, bukan akun default cakupan. */
  accountExplicit: boolean;
  /** Teks menyebut tanggal selain hari ini. */
  dateExplicit: boolean;
}

/**
 * Isi field kosong kartu dengan hasil AI; field yang sudah diisi parser tidak ditimpa.
 * Jenis "expense" tanpa kategori adalah tebakan parser dari adanya nominal, jadi boleh dikoreksi AI.
 */
export function mergeAiFields(item: PreviewItem, ai: AiLineFields, ctx: QuickAddContextData, facts: ParserFacts): PreviewItem {
  const filled = new Set<AiField>();
  const take = <T>(field: AiField, current: T | null, fromAi: T | null): T | null => {
    if (current !== null || fromAi === null) return current;
    filled.add(field);
    return fromAi;
  };

  const kindGuessed = item.kind === "expense" && item.categoryId === null;
  let kind = item.kind;
  if ((kind === null || kindGuessed) && ai.kind !== null && ai.kind !== kind) {
    kind = ai.kind;
    filled.add("kind");
  } else if (kind === null && ai.categoryId) {
    kind = ctx.categories.find((c) => c.id === ai.categoryId)?.kind ?? null;
    if (kind) filled.add("kind");
  }

  let accountId = item.accountId;
  if (!facts.accountExplicit && ai.accountId && ai.accountId !== item.accountId) {
    accountId = ai.accountId;
    filled.add("account");
  }

  let toAccountId: string | null = null;
  let categoryId: string | null = null;
  if (kind === "transfer") {
    toAccountId = take("toAccount", item.toAccountId, ai.toAccountId !== accountId ? ai.toAccountId : null);
  } else if (kind !== null) {
    const aiCategory = ctx.categories.find((c) => c.id === ai.categoryId && c.kind === kind)?.id ?? null;
    const own = ctx.categories.find((c) => c.id === item.categoryId && c.kind === kind)?.id ?? null;
    categoryId = take("category", own, aiCategory);
  }

  let occurredAt = item.occurredAt;
  if (!facts.dateExplicit && ai.occurredAt && dateKey(ai.occurredAt) !== dateKey(item.occurredAt)) {
    occurredAt = ai.occurredAt;
    filled.add("date");
  }

  return {
    ...item,
    kind,
    amount: take("amount", item.amount, ai.amount),
    accountId,
    toAccountId,
    categoryId,
    occurredAt,
    note: take("note", item.note, ai.note),
    recipient: take("recipient", item.recipient, ai.recipient),
    aiFields: [...filled],
  };
}

const PATCH_FIELDS: Partial<Record<keyof PreviewItem, AiField>> = {
  kind: "kind",
  amount: "amount",
  accountId: "account",
  toAccountId: "toAccount",
  categoryId: "category",
  occurredAt: "date",
  note: "note",
  recipient: "recipient",
};

/** Field yang diubah tangan tidak lagi ditandai hasil AI. */
export function dropEditedAiFields(fields: AiField[] | undefined, patchKeys: string[]): AiField[] | undefined {
  if (!fields || fields.length === 0) return fields;
  const edited = new Set(patchKeys.map((k) => PATCH_FIELDS[k as keyof PreviewItem]).filter(Boolean));
  return fields.filter((f) => !edited.has(f));
}

/**
 * Gabungkan jawaban AI (urut sesuai indexes) ke kartu pratinjau.
 * Parser dijalankan ulang tanpa akun default untuk tahu akun mana yang benar-benar disebut di teks.
 */
export function applyAiResults(
  items: PreviewItem[],
  drafts: QuickAddDraft[],
  indexes: number[],
  data: Array<AiLineFields | null>,
  ctx: QuickAddContextData,
  parserCtx: QuickAddContext,
): PreviewItem[] {
  const strictCtx: QuickAddContext = { ...parserCtx, defaultAccountId: undefined };
  const today = dateKey(parserCtx.now);
  const next = [...items];
  indexes.forEach((index, j) => {
    const ai = data[j];
    const item = next[index];
    const draft = drafts[index];
    if (!ai || !item || !draft) return;
    const [strict] = parseQuickAdd(draft.raw, strictCtx);
    next[index] = mergeAiFields(item, ai, ctx, {
      accountExplicit: Boolean(strict?.accountId),
      dateExplicit: dateKey(draft.occurredAt) !== today,
    });
  });
  return next;
}
