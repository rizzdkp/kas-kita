import { inArray } from "drizzle-orm";
import { formatRupiah } from "@/lib/money";
import type { Tx } from "@/server/db/client";
import { accounts, type AccountType } from "@/server/db/schema";
import { InsufficientBalanceError } from "@/server/errors";
import { getAccountBalances } from "@/server/queries/balances";

export interface BalanceEffectSource {
  kind: "income" | "expense" | "transfer";
  amount: bigint;
  accountId: string;
  toAccountId: string | null;
  status: "confirmed" | "draft";
}

/** Perubahan saldo per akun; draf tidak memengaruhi saldo. */
export function balanceEffects(items: BalanceEffectSource[]): Map<string, bigint> {
  const effects = new Map<string, bigint>();
  const add = (id: string, v: bigint) => effects.set(id, (effects.get(id) ?? 0n) + v);
  for (const t of items) {
    if (t.status !== "confirmed") continue;
    if (t.kind === "income") add(t.accountId, t.amount);
    else add(t.accountId, -t.amount);
    if (t.kind === "transfer" && t.toAccountId) add(t.toAccountId, t.amount);
  }
  return effects;
}

/** Tunai tidak pernah boleh negatif; bank dan e-wallet hanya kalau allow_negative (PRD 5.4). */
export function mustStayNonNegative(type: AccountType, allowNegative: boolean): boolean {
  if (type === "cash") return true;
  if (type === "bank" || type === "ewallet") return !allowNegative;
  return false;
}

export function insufficientBalanceMessage(accountName: string, available: bigint): string {
  return `Saldo ${accountName} tinggal ${formatRupiah(available)}. Kurangi nominal atau catat dari akun lain.`;
}

// baris akun dikunci supaya dua simpan bersamaan tidak lolos berdua
export async function assertBalancesAllowed(
  tx: Tx,
  effects: Map<string, bigint>,
  excludeTransactionIds: string[] = [],
): Promise<void> {
  const outflowIds = [...effects].filter(([, v]) => v < 0n).map(([id]) => id);
  if (outflowIds.length === 0) return;
  const rows = await tx
    .select({ id: accounts.id, name: accounts.name, type: accounts.type, allowNegative: accounts.allowNegative })
    .from(accounts)
    .where(inArray(accounts.id, outflowIds))
    .orderBy(accounts.id)
    .for("update");
  const restricted = rows.filter((a) => mustStayNonNegative(a.type, a.allowNegative));
  if (restricted.length === 0) return;
  const balances = await getAccountBalances({ accountIds: restricted.map((a) => a.id), excludeTransactionIds }, tx);
  for (const a of restricted) {
    const available = balances.get(a.id) ?? 0n;
    if (available + (effects.get(a.id) ?? 0n) < 0n) {
      throw new InsufficientBalanceError(a.id, insufficientBalanceMessage(a.name, available), available);
    }
  }
}
