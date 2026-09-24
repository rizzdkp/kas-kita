import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getAccountBalance } from "@/server/queries/balances";
import { getSystemCategory } from "@/server/queries/categories";
import { inTransaction, parseInput, signedAmountSchema, versionSchema } from "./_shared";
import { updateWithAudit } from "./audit";
import { mustStayNonNegative } from "./balance-guard";
import { createTransaction, type TransactionRow } from "./transactions";

const reconcileSchema = z.object({
  accountId: z.uuid(),
  version: versionSchema,
  actualBalance: signedAmountSchema,
  at: z.coerce.date().optional(),
});

export interface ReconcileResult {
  recorded: bigint;
  actual: bigint;
  difference: bigint;
  adjustment: TransactionRow | null;
}

/**
 * F-ACC-2: selisih saldo dicatat sebagai transaksi kategori sistem "Penyesuaian saldo",
 * yang tidak dihitung di pemasukan, pengeluaran, dan rasio tabungan.
 */
export async function reconcileAccount(viewer: Viewer, input: z.input<typeof reconcileSchema>, db: DbOrTx = defaultDb): Promise<ReconcileResult> {
  const data = parseInput(reconcileSchema, input);
  return inTransaction(db, async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, data.accountId)).for("update");
    if (!account || account.deletedAt) throw new NotFoundError("akun", data.accountId);
    if (data.actualBalance < 0n && mustStayNonNegative(account.type, account.allowNegative)) {
      throw new ValidationError(`Saldo ${account.name} tidak boleh negatif`, { actualBalance: ["Tidak boleh negatif"] });
    }
    const at = data.at ?? new Date();
    const recorded = await getAccountBalance(account.id, {}, tx);
    const difference = data.actualBalance - recorded;
    let adjustment: TransactionRow | null = null;
    if (difference !== 0n) {
      const category = await getSystemCategory("adjustment", tx);
      adjustment = await createTransaction(
        viewer,
        {
          kind: difference > 0n ? "income" : "expense",
          amount: difference > 0n ? difference : -difference,
          accountId: account.id,
          categoryId: category.id,
          occurredAt: at,
          source: "adjustment",
          note: "Penyesuaian saldo",
        },
        tx,
      );
    }
    await updateWithAudit(tx, accounts, {
      id: account.id,
      expectedVersion: data.version,
      actorId: viewer.user.id,
      values: { lastReconciledAt: at },
    });
    return { recorded, actual: data.actualBalance, difference, adjustment };
  });
}
