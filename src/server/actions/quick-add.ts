"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { InsufficientBalanceError } from "@/server/errors";
import { parseInput } from "@/server/mutations/_shared";
import { createTransactions, deleteTransaction } from "@/server/mutations/transactions";
import { runAction, type ActionError, type ActionResult } from "./result";

const itemSchema = z.object({
  clientId: z.uuid(),
  kind: z.enum(["income", "expense", "transfer"]),
  amount: z.bigint(),
  accountId: z.uuid(),
  toAccountId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  occurredAt: z.coerce.date(),
  note: z.string().max(500).nullable(),
  beneficiary: z.enum(["owner", "partner_of_owner", "shared"]),
});

export type QuickAddSaveItem = z.input<typeof itemSchema>;
export type SavedRef = { id: string; version: number; clientId: string | null };
/** accountId diisi kalau saldo akun itu tidak cukup, supaya error tampil di kartu yang tepat. */
export type QuickAddSaveResult = { ok: true; data: SavedRef[] } | (ActionError & { accountId?: string });

/** Simpan semua kartu pratinjau sekaligus (F-IN-2 AC3/AC4); clientId membuat kiriman ulang tidak dobel. */
export async function createQuickAddAction(items: QuickAddSaveItem[]): Promise<QuickAddSaveResult> {
  const viewer = await requireViewer();
  let failedAccountId: string | undefined;
  const result = await runAction(async () => {
    const list = parseInput(z.array(itemSchema).min(1).max(100), items);
    try {
      const rows = await createTransactions(viewer, list.map((i) => ({ ...i, source: "quick_add" as const })));
      return rows.map((r) => ({ id: r.id, version: r.version, clientId: r.clientId }));
    } catch (e) {
      if (e instanceof InsufficientBalanceError) failedAccountId = e.accountId;
      throw e;
    }
  });
  if (result.ok) return result;
  return failedAccountId ? { ...result, accountId: failedAccountId } : result;
}

const undoSchema = z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })).min(1).max(100);

/** "Urungkan" di toast: hapus lunak transaksi yang baru dibuat, semuanya atau tidak sama sekali. */
export async function undoQuickAddAction(refs: Array<{ id: string; version: number }>): Promise<ActionResult<void>> {
  const viewer = await requireViewer();
  return runAction(async () => {
    const list = parseInput(undoSchema, refs);
    await db.transaction(async (tx) => {
      for (const ref of list) await deleteTransaction(viewer, ref, tx);
    });
  });
}
