import type { AccountType } from "@/server/db/schema";

/** Setiap metrik membawa rumus dan angka asli untuk panel "Cara menghitung" (PRD bagian 6). */
export interface Metric<T> {
  value: T;
  formula: string;
  inputs: Record<string, bigint | number | string>;
}

export type AccountGroup = "liquid" | "liability" | "asset";

const GROUP_BY_TYPE: Record<AccountType, AccountGroup> = {
  bank: "liquid",
  ewallet: "liquid",
  cash: "liquid",
  credit_card: "liability",
  paylater: "liability",
  loan: "liability",
  investment: "asset",
  other_asset: "asset",
};

export function accountGroup(type: AccountType): AccountGroup {
  return GROUP_BY_TYPE[type];
}

/** Saldo akun yang sudah dihitung; `value` = nilai pasar terakhir untuk investasi, selain itu saldo. */
export interface AccountBalanceInput {
  id: string;
  name: string;
  type: AccountType;
  ownerId: string | null;
  balance: bigint;
  value: bigint;
}

export function sumBigint(values: Iterable<bigint>): bigint {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}

export function absBigint(v: bigint): bigint {
  return v < 0n ? -v : v;
}

/** Label input unik walau nama akun sama. */
export function inputKey(existing: Record<string, unknown>, label: string): string {
  let key = label;
  let n = 2;
  while (key in existing) key = `${label} (${n++})`;
  return key;
}
