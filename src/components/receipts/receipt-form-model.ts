import { MINUS, parseAmount } from "@/lib/money";
import { fromLocalInput, groupAmount, toLocalInput } from "@/components/transactions/form-values";
import { choiceToBeneficiary, type BeneficiaryChoice } from "@/components/transactions/labels";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { groupLinesByCategory, primaryCategoryId, sumLines, type ReceiptLine } from "./receipt-math";

/** Bentuk draf dari server (sama dengan ReceiptDraft di skema AI, ditulis ulang supaya klien tidak mengimpor modul server). */
export interface ReceiptDraftData {
  merchant: string | null;
  date: string | null;
  time: string | null;
  total: bigint | null;
  items: ReceiptLine[];
}

export type SaveMode = "single" | "split";

export interface ItemState {
  key: string;
  name: string;
  amountText: string;
  categoryId: string;
}

export interface ReceiptFormState {
  note: string;
  occurredLocal: string;
  totalText: string;
  accountId: string;
  beneficiary: BeneficiaryChoice;
  mode: SaveMode;
  categoryId: string;
  items: ItemState[];
}

let keySeq = 0;
export function newItemKey(): string {
  keySeq += 1;
  return `item-${keySeq}`;
}

export function amountText(v: bigint): string {
  return v < 0n ? `${MINUS}${groupAmount(-v)}` : groupAmount(v);
}

export function ownerChoice(options: TransactionFormOptions, accountId: string): BeneficiaryChoice {
  const owner = options.accounts.find((a) => a.id === accountId)?.ownerId ?? null;
  if (owner === null) return "shared";
  return owner === options.people.me.id ? "me" : "partner";
}

function occurredLocalFrom(draft: ReceiptDraftData, now: Date): string {
  if (!draft.date) return toLocalInput(now);
  // struk tanpa jam: tengah hari supaya tidak bergeser ke hari lain di zona mana pun
  return `${draft.date}T${draft.time ?? "12:00"}`;
}

/** Nilai awal pratinjau: dipecah otomatis kalau AI menemukan lebih dari satu kategori. */
export function initialFormState(draft: ReceiptDraftData, options: TransactionFormOptions, accountId: string, now: Date = new Date()): ReceiptFormState {
  const groups = groupLinesByCategory(draft.items).filter((g) => g.categoryId);
  const total = draft.total ?? (draft.items.length > 0 ? sumLines(draft.items) : null);
  return {
    note: draft.merchant ?? "",
    occurredLocal: occurredLocalFrom(draft, now),
    totalText: total !== null && total > 0n ? amountText(total) : "",
    accountId,
    beneficiary: ownerChoice(options, accountId),
    mode: groups.length > 1 ? "split" : "single",
    categoryId: primaryCategoryId(groups) ?? "",
    items: draft.items.map((i) => ({ key: newItemKey(), name: i.name, amountText: amountText(i.amount), categoryId: i.categoryId ?? "" })),
  };
}

/** Item yang nominalnya terbaca; baris dengan nominal kosong atau tidak valid dilewati. */
export function parsedLines(state: ReceiptFormState): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  for (const item of state.items) {
    const amount = parseAmount(item.amountText);
    if (amount === null) continue;
    out.push({ name: item.name, amount, categoryId: item.categoryId || null });
  }
  return out;
}

export function parsedTotal(state: ReceiptFormState): bigint | null {
  const v = parseAmount(state.totalText);
  return v !== null && v > 0n ? v : null;
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} dan ${words[words.length - 1]}`;
}

/** Alasan tombol Simpan nonaktif, atau null kalau siap disimpan. */
export function blockingReason(state: ReceiptFormState): string | null {
  const missing: string[] = [];
  if (parsedTotal(state) === null) missing.push("total");
  if (!state.accountId) missing.push("akun");
  if (!fromLocalInput(state.occurredLocal)) missing.push("tanggal");
  if (state.mode === "single" && !state.categoryId) missing.push("kategori");
  if (missing.length > 0) return `Lengkapi ${joinWords(missing)} untuk menyimpan.`;
  if (state.mode === "split") {
    if (state.items.some((i) => parseAmount(i.amountText) === null)) return "Isi nominal setiap item, atau buang baris yang kosong.";
    if (state.items.length === 0) return "Tambahkan item untuk memecah per kategori.";
    if (state.items.some((i) => !i.categoryId)) return "Pilih kategori untuk setiap item sebelum memecah per kategori.";
    if (sumLines(parsedLines(state)) !== parsedTotal(state)) return "Samakan jumlah item dengan total sebelum memecah per kategori.";
  }
  return null;
}

export interface ReceiptSavePayload {
  attachmentId: string;
  clientId: string;
  mode: SaveMode;
  amount: bigint;
  accountId: string;
  categoryId: string | null;
  occurredAt: Date;
  note: string | null;
  beneficiary: "owner" | "partner_of_owner" | "shared";
  items: Array<{ name: string; amount: bigint; categoryId: string | null }>;
}

export function toSavePayload(state: ReceiptFormState, options: TransactionFormOptions, attachmentId: string, clientId: string): ReceiptSavePayload | null {
  const amount = parsedTotal(state);
  const occurredAt = fromLocalInput(state.occurredLocal);
  if (blockingReason(state) || amount === null || !occurredAt) return null;
  const owner = options.accounts.find((a) => a.id === state.accountId)?.ownerId ?? null;
  return {
    attachmentId,
    clientId,
    mode: state.mode,
    amount,
    accountId: state.accountId,
    categoryId: state.mode === "single" ? state.categoryId : null,
    occurredAt,
    note: state.note.trim() ? state.note.trim().slice(0, 500) : null,
    beneficiary: choiceToBeneficiary(state.beneficiary, owner, options.people),
    items: parsedLines(state),
  };
}
