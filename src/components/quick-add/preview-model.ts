import type { Scope } from "@/lib/scope";
import type { Beneficiary, QuickAddContext, QuickAddDraft, QuickAddKind } from "@/lib/quick-add-parser";
import { BENEFICIARY_PREFIXES, OWNER_WORDS } from "@/lib/quick-add-keywords";
import type { Party, PreviewField, PreviewItem, QuickAddContextAccount, QuickAddContextData } from "./types";

const OWNER_ORDER: Record<Scope, Party[]> = {
  me: ["me", "shared", "partner"],
  partner: ["partner", "shared", "me"],
  all: ["me", "shared", "partner"],
};

/** Akun di cakupan aktif didahulukan supaya kata yang ambigu jatuh ke akun cakupan itu. */
export function orderAccountsForScope(list: QuickAddContextAccount[], scope: Scope): QuickAddContextAccount[] {
  const order = OWNER_ORDER[scope];
  return [...list].sort((a, b) => order.indexOf(a.owner) - order.indexOf(b.owner));
}

export function defaultAccountFor(ctx: QuickAddContextData, scope: Scope): string | null {
  return ctx.defaults[scope] ?? ctx.defaults.me ?? ctx.accounts[0]?.id ?? null;
}

export function buildParserContext(ctx: QuickAddContextData, scope: Scope, now: Date): QuickAddContext {
  return {
    accounts: orderAccountsForScope(ctx.accounts, scope).map((a) => ({ id: a.id, name: a.name, aliases: a.aliases })),
    categories: ctx.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, keywords: c.keywords })),
    now,
    defaultAccountId: defaultAccountFor(ctx, scope) ?? undefined,
    partnerName: ctx.partnerName ?? undefined,
  };
}

// parser memberi "owner" untuk "untuk saya" maupun tanpa keterangan; hanya yang eksplisit berarti yang login
function saysForMe(raw: string): boolean {
  const words = raw.toLowerCase().split(/\s+/);
  return words.some((w, i) => BENEFICIARY_PREFIXES.has(w) && OWNER_WORDS.has(words[i + 1] ?? ""));
}

function recipientFromDraft(draft: QuickAddDraft): Party | null {
  if (draft.beneficiary === "shared") return "shared";
  if (draft.beneficiary === "partner_of_owner") return "partner";
  return saysForMe(draft.raw) ? "me" : null;
}

export function draftToItem(draft: QuickAddDraft, clientId: string): PreviewItem {
  return {
    clientId,
    raw: draft.raw,
    kind: draft.kind,
    amount: draft.amount,
    accountId: draft.accountId,
    toAccountId: draft.kind === "transfer" ? draft.toAccountId : null,
    categoryId: draft.kind === "transfer" ? null : draft.categoryId,
    occurredAt: draft.occurredAt,
    note: draft.note,
    recipient: recipientFromDraft(draft),
    error: null,
  };
}

export type PreviewPatch = Partial<Omit<PreviewItem, "clientId" | "raw" | "error">>;

/** Terapkan edit dan buang field yang tidak lagi cocok dengan jenis baru. */
export function applyEdit(item: PreviewItem, patch: PreviewPatch, ctx: QuickAddContextData): PreviewItem {
  const next: PreviewItem = { ...item, ...patch, error: null };
  if (next.kind === "transfer") next.categoryId = null;
  else next.toAccountId = null;
  if (next.categoryId && next.kind !== "transfer") {
    const cat = ctx.categories.find((c) => c.id === next.categoryId);
    if (!cat || cat.kind !== next.kind) next.categoryId = null;
  }
  return next;
}

export function accountById(ctx: QuickAddContextData, id: string | null): QuickAddContextAccount | null {
  return id ? (ctx.accounts.find((a) => a.id === id) ?? null) : null;
}

/** Field wajib yang belum terisi, berurutan seperti di kartu. */
export function missingFields(item: PreviewItem, ctx: QuickAddContextData): PreviewField[] {
  const out: PreviewField[] = [];
  if (item.kind === null) out.push("kind");
  if (item.amount === null || item.amount <= 0n) out.push("amount");
  if (!accountById(ctx, item.accountId)) out.push("account");
  if (item.kind === "transfer") {
    if (!accountById(ctx, item.toAccountId) || item.toAccountId === item.accountId) out.push("toAccount");
  } else if (item.kind !== null) {
    const cat = ctx.categories.find((c) => c.id === item.categoryId);
    if (!cat || cat.kind !== item.kind) out.push("category");
  }
  return out;
}

const FIELD_NAMES: Record<PreviewField, string> = {
  kind: "jenis",
  amount: "nominal",
  account: "akun",
  toAccount: "akun tujuan",
  category: "kategori",
};

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} dan ${words[words.length - 1]}`;
}

/** Alasan tombol Simpan nonaktif, atau null kalau lengkap. */
export function missingReason(missing: PreviewField[]): string | null {
  if (missing.length === 0) return null;
  return `Lengkapi ${joinWords(missing.map((f) => FIELD_NAMES[f]))} untuk menyimpan.`;
}

/** Recipient efektif dari sudut pandang yang login. */
export function effectiveRecipient(item: PreviewItem, account: QuickAddContextAccount | null): Party {
  if (account?.owner === "shared") return "shared";
  return item.recipient ?? account?.owner ?? "me";
}

/** Recipient (sudut pandang yang login) menjadi beneficiary (relatif ke pemilik akun). */
export function toBeneficiary(recipient: Party, accountOwner: Party): Beneficiary {
  if (accountOwner === "shared" || recipient === "shared") return "shared";
  return recipient === accountOwner ? "owner" : "partner_of_owner";
}

export interface QuickAddCreateInput {
  clientId: string;
  kind: QuickAddKind;
  amount: bigint;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: Date;
  note: string | null;
  beneficiary: Beneficiary;
}

/** Input mutasi dari kartu yang lengkap; null kalau masih ada field kosong. */
export function toCreateInput(item: PreviewItem, ctx: QuickAddContextData): QuickAddCreateInput | null {
  if (missingFields(item, ctx).length > 0) return null;
  const account = accountById(ctx, item.accountId)!;
  const isTransfer = item.kind === "transfer";
  return {
    clientId: item.clientId,
    kind: item.kind!,
    amount: item.amount!,
    accountId: account.id,
    toAccountId: isTransfer ? item.toAccountId : null,
    categoryId: isTransfer ? null : item.categoryId,
    occurredAt: item.occurredAt,
    note: item.note?.trim() ? item.note.trim().slice(0, 500) : null,
    beneficiary: item.kind === "expense" ? toBeneficiary(effectiveRecipient(item, account), account.owner) : "owner",
  };
}

/** Error saldo menunjuk akun; tandai kartu yang mengambil uang dari akun itu. */
export function attachError(items: PreviewItem[], message: string, accountId: string | null): PreviewItem[] {
  const hit = (i: PreviewItem) => accountId !== null && i.accountId === accountId && i.kind !== "income";
  return items.map((i) => (hit(i) ? { ...i, error: message } : i));
}
