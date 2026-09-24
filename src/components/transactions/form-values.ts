import { jakartaDate, toJakarta } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { beneficiaryToChoice, choiceToBeneficiary, type BeneficiaryChoice } from "./labels";
import type { Beneficiary, TransactionFormInitial, TransactionFormOptions, TransactionKind } from "./types";

export interface FormValues {
  kind: TransactionKind;
  amountText: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  occurredLocal: string;
  note: string;
  beneficiary: BeneficiaryChoice;
  tagsText: string;
}

/** Field yang dikirim ke server (bentuk CreateTransactionInput tanpa clientId). */
export interface SubmitFields {
  kind: TransactionKind;
  amount: bigint;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: Date;
  note: string | null;
  beneficiary: Beneficiary;
  tagNames: string[];
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Nilai input datetime-local di WIB, lepas dari zona waktu perangkat. */
export function toLocalInput(d: Date): string {
  const z = toJakarta(d);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}T${pad(z.getHours())}:${pad(z.getMinutes())}`;
}

export function fromLocalInput(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return new Date(jakartaDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime());
}

export function groupAmount(v: bigint): string {
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function ownerMatchesScope(ownerId: string | null, scope: Scope, options: TransactionFormOptions): boolean {
  if (scope === "all") return true;
  const target = scope === "partner" ? options.people.partner?.id : options.people.me.id;
  return ownerId !== null && ownerId === target;
}

/** Akun default: terakhir dipakai di cakupan ini, atau akun pertama milik pemilik cakupan. */
export function defaultAccountId(options: TransactionFormOptions, scope: Scope): string {
  const usable = options.accounts.filter((a) => !a.archived);
  const last = usable.find((a) => a.id === options.defaults.accountId);
  if (last && ownerMatchesScope(last.ownerId, scope, options)) return last.id;
  const owned = usable.find((a) => ownerMatchesScope(a.ownerId, scope, options) && a.ownerId !== null);
  return (owned ?? usable[0])?.id ?? "";
}

export function categoryExists(options: TransactionFormOptions, kind: TransactionKind, id: string | null | undefined): boolean {
  if (!id || kind === "transfer") return false;
  return options.categories[kind].some((g) => g.id === id || g.children.some((c) => c.id === id));
}

export function initialValues(
  options: TransactionFormOptions,
  scope: Scope,
  initial: TransactionFormInitial | undefined,
  now: Date = new Date(),
): FormValues {
  const kind = initial?.kind ?? "expense";
  const accountId = initial?.accountId ?? defaultAccountId(options, scope);
  const ownerId = options.accounts.find((a) => a.id === accountId)?.ownerId ?? null;
  const fallbackCategory = kind === "expense" && !initial?.id ? options.defaults.categoryId : null;
  const categoryId = categoryExists(options, kind, initial?.categoryId) ? initial?.categoryId : categoryExists(options, kind, fallbackCategory) ? fallbackCategory : "";
  return {
    kind,
    amountText: initial?.amount ? groupAmount(initial.amount) : "",
    accountId,
    toAccountId: initial?.toAccountId ?? "",
    categoryId: categoryId ?? "",
    occurredLocal: toLocalInput(initial?.occurredAt ?? now),
    note: initial?.note ?? "",
    beneficiary: beneficiaryToChoice(initial?.beneficiary ?? "owner", ownerId, options.people),
    tagsText: (initial?.tagNames ?? []).join(", "),
  };
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(",").map((t) => t.trim()).filter(Boolean))];
}

/** Validasi ringan di klien; sisanya (kategori cocok, saldo tunai) diputuskan server. */
export function toSubmitFields(
  v: FormValues,
  options: TransactionFormOptions,
  keepBeneficiary: Beneficiary | undefined,
): { fields: SubmitFields | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const amount = parseAmount(v.amountText);
  if (amount === null || amount <= 0n) errors.amount = "Isi nominal, misalnya 25rb";
  const occurredAt = fromLocalInput(v.occurredLocal);
  if (!occurredAt) errors.occurredAt = "Isi tanggal dan waktu";
  if (!v.accountId) errors.accountId = "Pilih akun";
  if (v.kind === "transfer" && !v.toAccountId) errors.toAccountId = "Pilih akun tujuan transfer";
  if (v.kind === "transfer" && v.toAccountId && v.toAccountId === v.accountId) errors.toAccountId = "Akun tujuan harus berbeda dari akun asal";
  if (v.kind !== "transfer" && !v.categoryId) errors.categoryId = "Pilih kategori";
  if (Object.keys(errors).length > 0 || amount === null || !occurredAt) return { fields: null, errors };
  const ownerId = options.accounts.find((a) => a.id === v.accountId)?.ownerId ?? null;
  return {
    errors,
    fields: {
      kind: v.kind,
      amount,
      accountId: v.accountId,
      toAccountId: v.kind === "transfer" ? v.toAccountId : null,
      categoryId: v.kind === "transfer" ? null : v.categoryId,
      occurredAt,
      note: v.note.trim() || null,
      beneficiary: v.kind === "expense" ? choiceToBeneficiary(v.beneficiary, ownerId, options.people) : (keepBeneficiary ?? "owner"),
      tagNames: parseTags(v.tagsText),
    },
  };
}

/** Kunci fieldErrors server ("tagNames.0") ke nama field form. */
export function mapFieldErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    const parts = key.split(".");
    const field = (parts[0] === "patch" ? parts[1] : parts[0]) ?? "_";
    const target = field === "tagNames" ? "tags" : field;
    if (messages[0] && !out[target]) out[target] = messages[0];
  }
  return out;
}
