"use server";

import { z } from "zod";
import { SCOPES, type Scope } from "@/lib/scope";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { requireViewer } from "@/server/auth/session";
import type { Viewer } from "@/server/auth/viewer";
import { ValidationError } from "@/server/errors";
import {
  createTransaction,
  createTransactions,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
  type TransactionRow,
} from "@/server/mutations/transactions";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/server/mutations/transaction-input";
import { listAccounts } from "@/server/queries/accounts";
import { listCategories } from "@/server/queries/categories";
import {
  getTransaction,
  listTransactions,
  transactionFiltersSchema,
  type TransactionDetail,
  type TransactionFilters,
  type TransactionPage,
} from "@/server/queries/transactions";
import { loadTransactionFormOptions } from "@/server/queries/transaction-form";
import { runAction, toActionError, type ActionResult } from "./result";

export type { CreateTransactionInput, UpdateTransactionInput, TransactionFilters };

// input mentah divalidasi Zod di mutasi; di sini cukup memastikan bentuk objeknya
const objectInput = z.record(z.string(), z.unknown());

/** Baca data tanpa revalidatePath: runAction menyegarkan seluruh halaman, tidak perlu untuk query. */
async function runQuery<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toActionError(e);
  }
}

function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Data tidak valid");
  return r.data;
}

export async function createTransactionAction(input: CreateTransactionInput): Promise<ActionResult<TransactionRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return createTransaction(viewer, parseOrThrow(objectInput, input) as CreateTransactionInput);
  });
}

/** Banyak transaksi sekaligus (quick-add "Simpan semua"): semua atau tidak sama sekali. */
export async function createTransactionsAction(inputs: CreateTransactionInput[]): Promise<ActionResult<TransactionRow[]>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return createTransactions(viewer, parseOrThrow(z.array(objectInput), inputs) as CreateTransactionInput[]);
  });
}

/** Versi lama ditolak; hasil gagal membawa `conflict` berisi baris terbaru (F-HIST-3). */
export async function updateTransactionAction(input: UpdateTransactionInput): Promise<ActionResult<TransactionRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return updateTransaction(viewer, parseOrThrow(objectInput, input) as UpdateTransactionInput);
  });
}

export async function deleteTransactionAction(input: { id: string; version: number }): Promise<ActionResult<TransactionRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return deleteTransaction(viewer, parseOrThrow(z.object({ id: z.uuid(), version: z.number().int().positive() }), input));
  });
}

export async function restoreTransactionAction(input: { id: string }): Promise<ActionResult<TransactionRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return restoreTransaction(viewer, parseOrThrow(z.object({ id: z.uuid() }), input));
  });
}

export interface TransactionDetailResult {
  detail: TransactionDetail;
  /** Nama akun dan kategori untuk menerjemahkan uuid di riwayat. */
  names: Record<string, string>;
}

async function referenceNames(viewer: Viewer): Promise<Record<string, string>> {
  const [accounts, categories] = await Promise.all([
    listAccounts(viewer, { scope: "all", includeArchived: true }),
    listCategories({ includeArchived: true }),
  ]);
  const names: Record<string, string> = {};
  for (const a of accounts.all) names[a.id] = a.name;
  for (const c of categories) {
    names[c.id] = c.name;
    for (const child of c.children) names[child.id] = `${c.name} › ${child.name}`;
  }
  return names;
}

export async function getTransactionDetailAction(id: string): Promise<ActionResult<TransactionDetailResult>> {
  return runQuery(async () => {
    const viewer = await requireViewer();
    const txId = parseOrThrow(z.uuid(), id);
    const [detail, names] = await Promise.all([getTransaction(viewer, txId), referenceNames(viewer)]);
    return { detail, names };
  });
}

const listInputSchema = z.object({
  filters: transactionFiltersSchema,
  cursor: z.string().max(200).nullish(),
  limit: z.number().int().min(1).max(200).optional(),
});

export async function listTransactionsAction(input: {
  filters: TransactionFilters;
  cursor?: string | null;
  limit?: number;
}): Promise<ActionResult<TransactionPage>> {
  return runQuery(async () => {
    const viewer = await requireViewer();
    const { filters, cursor, limit } = parseOrThrow(listInputSchema, input);
    return listTransactions(viewer, filters, { cursor, limit });
  });
}

export async function getTransactionFormOptionsAction(scope: Scope): Promise<ActionResult<TransactionFormOptions>> {
  return runQuery(async () => {
    const viewer = await requireViewer();
    return loadTransactionFormOptions(viewer, parseOrThrow(z.enum(SCOPES), scope));
  });
}
