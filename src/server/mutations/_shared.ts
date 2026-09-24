import { z } from "zod";
import { MAX_AMOUNT, parseAmount } from "@/lib/money";
import type { DbOrTx, Tx } from "@/server/db/client";
import { ValidationError } from "@/server/errors";

export const EMPTY_AMOUNT_MESSAGE = "Isi nominal, misalnya 25rb";

/** Nominal dari UI boleh bigint, string digit, atau teks seperti "25rb"; selalu jadi bigint rupiah. */
export const amountSchema = z
  .union([z.bigint(), z.string(), z.number().int()])
  .transform((v, ctx) => {
    const parsed = typeof v === "bigint" ? v : typeof v === "number" ? BigInt(v) : /^\d+$/.test(v.trim()) ? BigInt(v.trim()) : parseAmount(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: EMPTY_AMOUNT_MESSAGE });
      return z.NEVER;
    }
    return parsed;
  })
  .refine((v) => v > 0n && v <= MAX_AMOUNT, EMPTY_AMOUNT_MESSAGE);

/** Nominal yang boleh nol atau negatif (saldo awal, saldo rekonsiliasi). */
export const signedAmountSchema = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((v) => (typeof v === "bigint" ? v : BigInt(v)));

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD");
export const versionSchema = z.number().int().positive();

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = result.error.issues[0]?.message ?? "Data tidak valid";
  throw new ValidationError(first, fieldErrors);
}

/** Semua mutasi berjalan dalam satu transaksi database; db tes bisa disuntik. */
export function inTransaction<T>(db: DbOrTx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

/** Zod 4 tetap mengisi default di dalam .partial(); tanpa ini edit satu field mereset field lain. */
export function pickProvided<T extends object>(parsed: T, raw: unknown): Partial<T> {
  if (!raw || typeof raw !== "object") return {};
  const keys = new Set(Object.keys(raw as object));
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => keys.has(k))) as Partial<T>;
}
