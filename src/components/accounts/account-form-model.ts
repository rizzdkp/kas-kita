import { formatAmountInput, parseAmount } from "@/lib/money";
import type { People } from "@/components/transactions/types";
import type { AccountType } from "@/server/db/schema";
import type { AccountWithBalance } from "@/server/queries/accounts";
import type { AccountFormInput } from "@/server/actions/accounts";
import { canOverdraft, hasCreditTerms, isLiabilityType } from "./labels";

export type OwnerChoice = "me" | "partner" | "shared";

export interface AccountFormState {
  name: string;
  type: AccountType;
  owner: OwnerChoice;
  /** "none" = tanpa institusi (Radix Select tidak menerima nilai kosong). */
  institutionId: string;
  openingText: string;
  openingDate: string;
  allowNegative: boolean;
  limitText: string;
  statementDay: string;
  dueDay: string;
}

export type FormErrors = Partial<Record<keyof AccountFormState, string>>;

export const NO_INSTITUTION = "none";

export function ownerChoiceOf(people: People, ownerId: string | null): OwnerChoice {
  if (ownerId === null) return "shared";
  return ownerId === people.me.id ? "me" : "partner";
}

export function ownerIdOf(people: People, owner: OwnerChoice): string | null {
  if (owner === "me") return people.me.id;
  if (owner === "partner") return people.partner?.id ?? people.me.id;
  return null;
}

function amountText(v: bigint | null): string {
  return v === null ? "" : formatAmountInput(v.toString());
}

export function initialFormState(
  people: People,
  opts: { account: AccountWithBalance | null; presetType?: AccountType; presetOwner?: OwnerChoice; today: string },
): AccountFormState {
  const a = opts.account;
  if (!a) {
    return {
      name: "",
      type: opts.presetType ?? "bank",
      owner: opts.presetOwner ?? "me",
      institutionId: NO_INSTITUTION,
      openingText: "",
      openingDate: opts.today,
      allowNegative: false,
      limitText: "",
      statementDay: "",
      dueDay: "",
    };
  }
  const opening = isLiabilityType(a.type) ? -a.openingBalance : a.openingBalance;
  return {
    name: a.name,
    type: a.type,
    owner: ownerChoiceOf(people, a.ownerId),
    institutionId: a.institutionId ?? NO_INSTITUTION,
    openingText: opening === 0n ? "" : amountText(opening),
    openingDate: a.openingDate,
    allowNegative: a.allowNegative,
    limitText: amountText(a.creditLimit),
    statementDay: a.statementDay?.toString() ?? "",
    dueDay: a.dueDay?.toString() ?? "",
  };
}

function parseDay(text: string): number | null | "invalid" {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : "invalid";
}

/** Validasi klien sebelum dikirim; server tetap memvalidasi ulang. */
export function toAccountInput(
  state: AccountFormState,
  people: People,
): { ok: true; input: AccountFormInput } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  if (state.name.trim() === "") errors.name = "Isi nama akun";

  const liability = isLiabilityType(state.type);
  const parsedOpening = state.openingText.trim() === "" ? 0n : parseAmount(state.openingText);
  let openingBalance = 0n;
  if (parsedOpening === null) {
    errors.openingText = "Nominal belum terbaca, misalnya 2,5jt";
  } else if (liability) {
    openingBalance = parsedOpening < 0n ? parsedOpening : -parsedOpening;
  } else if (parsedOpening < 0n && !(canOverdraft(state.type) && state.allowNegative)) {
    errors.openingText =
      state.type === "cash" ? "Saldo Tunai tidak boleh negatif" : "Saldo awal negatif hanya untuk akun yang mengizinkan saldo negatif";
  } else {
    openingBalance = parsedOpening;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.openingDate)) errors.openingDate = "Pilih tanggal saldo awal";

  const credit = hasCreditTerms(state.type);
  let creditLimit: bigint | null = null;
  let statementDay: number | null = null;
  let dueDay: number | null = null;
  if (credit) {
    if (state.limitText.trim() !== "") {
      const limit = parseAmount(state.limitText);
      if (limit === null || limit <= 0n) errors.limitText = "Isi limit, misalnya 10jt";
      else creditLimit = limit;
    }
    const s = parseDay(state.statementDay);
    const d = parseDay(state.dueDay);
    if (s === "invalid") errors.statementDay = "Tanggal 1 sampai 31";
    else statementDay = s;
    if (d === "invalid") errors.dueDay = "Tanggal 1 sampai 31";
    else dueDay = d;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name: state.name.trim(),
      type: state.type,
      ownerId: ownerIdOf(people, state.owner),
      institutionId: state.institutionId === NO_INSTITUTION ? null : state.institutionId,
      openingBalance,
      openingDate: state.openingDate,
      allowNegative: canOverdraft(state.type) && state.allowNegative,
      creditLimit,
      statementDay,
      dueDay,
    },
  };
}

/** Kunci fieldErrors server ke field form. */
export function mapServerErrors(fieldErrors: Record<string, string[]> | undefined): FormErrors {
  if (!fieldErrors) return {};
  const map: Record<string, keyof AccountFormState> = {
    name: "name",
    "patch.name": "name",
    openingBalance: "openingText",
    "patch.openingBalance": "openingText",
    openingDate: "openingDate",
    "patch.openingDate": "openingDate",
    creditLimit: "limitText",
    "patch.creditLimit": "limitText",
    statementDay: "statementDay",
    "patch.statementDay": "statementDay",
    dueDay: "dueDay",
    "patch.dueDay": "dueDay",
    ownerId: "owner",
    "patch.ownerId": "owner",
  };
  const out: FormErrors = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const field = map[key];
    if (field && messages[0]) out[field] = messages[0];
  }
  return out;
}
