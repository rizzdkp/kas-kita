import type { ParsedRow } from "../types";

export const BALANCE_MISMATCH_KEY = "__balanceMismatch";

/**
 * Saldo berjalan: untuk dua baris berurutan yang sama-sama punya saldo, saldo sebelumnya + nominal
 * harus sama dengan saldo baris ini. Baris yang tidak cocok ditandai raw.__balanceMismatch = "1".
 */
export function markBalanceMismatches(rows: ReadonlyArray<ParsedRow>): { rows: ParsedRow[]; mismatches: number } {
  let previous: bigint | null = null;
  let mismatches = 0;
  const out = rows.map((row) => {
    let next = row;
    if (row.balance !== null && previous !== null && previous + row.amount !== row.balance) {
      mismatches += 1;
      next = { ...row, raw: { ...row.raw, [BALANCE_MISMATCH_KEY]: "1" } };
    }
    // baris tanpa saldo tetap meneruskan saldo hitungan supaya baris berikutnya masih bisa dicek
    previous = row.balance ?? (previous === null ? null : previous + row.amount);
    return next;
  });
  return { rows: out, mismatches };
}
