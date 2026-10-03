import { z } from "zod";
import type { ParsedRow } from "./types";
import type { DedupeResult } from "./dedupe";

// bentuk import_rows.parsed; nominal disimpan sebagai string digit karena jsonb tidak punya bigint
const signedDigits = z.string().regex(/^-?\d+$/);

export const storedParsedRowSchema = z.object({
  index: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  description: z.string(),
  normalizedDescription: z.string(),
  amount: signedDigits,
  balance: signedDigits.nullable(),
  group: z.enum(["new", "possible_duplicate", "exact_duplicate"]),
  dayDiff: z.number().int().nullable(),
});
export type StoredParsedRow = z.infer<typeof storedParsedRowSchema>;

export function toStoredParsedRow(row: ParsedRow, index: number, normalizedDescription: string, dedupe: DedupeResult): StoredParsedRow {
  return {
    index,
    date: row.date,
    time: row.time,
    description: row.description,
    normalizedDescription,
    amount: row.amount.toString(),
    balance: row.balance === null ? null : row.balance.toString(),
    group: dedupe.group,
    dayDiff: dedupe.dayDiff,
  };
}

/** Penanda dari parser PDF: saldo berjalan baris ini tidak cocok dengan saldo di mutasi. */
export const BALANCE_MISMATCH_KEY = "__balanceMismatch";

export function hasBalanceMismatch(raw: unknown): boolean {
  return typeof raw === "object" && raw !== null && (raw as Record<string, unknown>)[BALANCE_MISMATCH_KEY] === "1";
}
