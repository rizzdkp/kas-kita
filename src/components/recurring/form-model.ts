import { parseAmount } from "@/lib/money";
import type { RecurrenceFrequency } from "@/server/recurring/schedule";
import { categoryExists, defaultAccountId, groupAmount, parseTags } from "@/components/transactions/form-values";
import { beneficiaryToChoice, choiceToBeneficiary, type BeneficiaryChoice } from "@/components/transactions/labels";
import type { Beneficiary, TransactionFormOptions, TransactionKind } from "@/components/transactions/types";
import type { Scope } from "@/lib/scope";

/** Isian awal jadwal: dari jadwal yang diubah, atau dari transaksi lewat "Jadikan berulang". */
export interface RecurringInitial {
  kind: TransactionKind;
  amount: bigint | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string | null;
  beneficiary: Beneficiary;
  tagNames: string[];
  frequency: RecurrenceFrequency;
  interval: number;
  nextRunOn: string;
  autoConfirm: boolean;
}

export interface RecurringFormValues {
  kind: TransactionKind;
  amountText: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  note: string;
  beneficiary: BeneficiaryChoice;
  tagsText: string;
  frequency: RecurrenceFrequency;
  interval: number;
  nextRunOn: string;
  autoConfirm: boolean;
}

export const FREQUENCY_OPTIONS: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "yearly", label: "Tahunan" },
];

export function initialRecurringValues(options: TransactionFormOptions, scope: Scope, today: string, initial?: RecurringInitial): RecurringFormValues {
  const kind = initial?.kind ?? "expense";
  const accountId = initial?.accountId ?? defaultAccountId(options, scope);
  const ownerId = options.accounts.find((a) => a.id === accountId)?.ownerId ?? null;
  const fallback = kind === "expense" && !initial ? options.defaults.categoryId : null;
  const categoryId = categoryExists(options, kind, initial?.categoryId) ? initial?.categoryId : categoryExists(options, kind, fallback) ? fallback : "";
  return {
    kind,
    amountText: initial?.amount ? groupAmount(initial.amount) : "",
    accountId,
    toAccountId: initial?.toAccountId ?? "",
    categoryId: categoryId ?? "",
    note: initial?.note ?? "",
    beneficiary: beneficiaryToChoice(initial?.beneficiary ?? "owner", ownerId, options.people),
    tagsText: (initial?.tagNames ?? []).join(", "),
    frequency: initial?.frequency ?? "monthly",
    interval: initial?.interval ?? 1,
    nextRunOn: initial?.nextRunOn ?? today,
    autoConfirm: initial?.autoConfirm ?? false,
  };
}

export interface RecurringSubmit {
  kind: TransactionKind;
  amount: bigint;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string | null;
  beneficiary: Beneficiary;
  tagNames: string[];
  frequency: RecurrenceFrequency;
  interval: number;
  nextRunOn: string;
  autoConfirm: boolean;
}

/** Validasi ringan di klien; tanggal lampau, akun terhapus, dan kategori tidak cocok diputuskan server. */
export function toRecurringSubmit(
  v: RecurringFormValues,
  options: TransactionFormOptions,
  today: string,
  /** Tanggal tersimpan yang tidak diubah boleh tetap walau sudah lewat; job belum sempat jalan. */
  keepDate?: string,
): { fields: RecurringSubmit | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const amount = parseAmount(v.amountText);
  if (amount === null || amount <= 0n) errors.amount = "Isi nominal, misalnya 25rb";
  if (!v.accountId) errors.accountId = "Pilih akun";
  if (v.kind === "transfer" && !v.toAccountId) errors.toAccountId = "Pilih akun tujuan transfer";
  if (v.kind === "transfer" && v.toAccountId && v.toAccountId === v.accountId) errors.toAccountId = "Akun tujuan harus berbeda dari akun asal";
  if (v.kind !== "transfer" && !v.categoryId) errors.categoryId = "Pilih kategori";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.nextRunOn)) errors.nextRunOn = "Isi tanggal berikutnya";
  else if (v.nextRunOn < today && v.nextRunOn !== keepDate) errors.nextRunOn = "Tanggal berikutnya tidak boleh sebelum hari ini.";
  if (Object.keys(errors).length > 0 || amount === null) return { fields: null, errors };
  const ownerId = options.accounts.find((a) => a.id === v.accountId)?.ownerId ?? null;
  return {
    errors,
    fields: {
      kind: v.kind,
      amount,
      accountId: v.accountId,
      toAccountId: v.kind === "transfer" ? v.toAccountId : null,
      categoryId: v.kind === "transfer" ? null : v.categoryId,
      note: v.note.trim() || null,
      beneficiary: v.kind === "expense" ? choiceToBeneficiary(v.beneficiary, ownerId, options.people) : "owner",
      tagNames: parseTags(v.tagsText),
      frequency: v.frequency,
      interval: v.interval,
      nextRunOn: v.nextRunOn,
      autoConfirm: v.autoConfirm,
    },
  };
}
