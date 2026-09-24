import { formatRelativeDay } from "@/lib/dates";
import type { AccountType } from "@/server/db/schema";
import type { AccountGroup } from "@/server/metrics/types";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: "Bank",
  ewallet: "E-wallet",
  cash: "Tunai",
  credit_card: "Kartu kredit",
  paylater: "PayLater",
  loan: "Pinjaman",
  investment: "Investasi",
  other_asset: "Aset lain",
};

export const ACCOUNT_TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABEL[value],
}));

export const GROUP_LABEL: Record<AccountGroup, string> = {
  liquid: "Likuid",
  liability: "Kewajiban",
  asset: "Aset tidak likuid",
};

export function isAccountType(v: string | null | undefined): v is AccountType {
  return typeof v === "string" && v in ACCOUNT_TYPE_LABEL;
}

/** Saldo utang disimpan negatif; form dan tampilan memakai nilai utang positif. */
export function isLiabilityType(type: AccountType): boolean {
  return type === "credit_card" || type === "paylater" || type === "loan";
}

/** Kartu kredit dan PayLater punya limit, tanggal cetak, dan jatuh tempo (F-ACC-1 AC3). */
export function hasCreditTerms(type: AccountType): boolean {
  return type === "credit_card" || type === "paylater";
}

/** Overdraft hanya untuk Bank dan E-wallet; Tunai tidak pernah negatif (PRD 5.4). */
export function canOverdraft(type: AccountType): boolean {
  return type === "bank" || type === "ewallet";
}

/** "hari ini", "kemarin", atau "12 Sep" untuk dipakai di tengah kalimat. */
export function relativeDayInline(d: Date): string {
  const text = formatRelativeDay(d);
  return text === "Hari ini" || text === "Kemarin" ? text.toLowerCase() : text;
}
