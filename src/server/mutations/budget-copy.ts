import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { budgets } from "@/server/db/schema";
import { addMonthsKey, monthStartKey } from "@/server/metrics/_time";
import { dateKeySchema, inTransaction, parseInput } from "./_shared";
import { upsertBudget } from "./budgets";

const copySchema = z.object({
  /** Bulan tujuan (hari mana pun di bulan itu). */
  month: dateKeySchema.transform(monthStartKey),
  scopeOwners: z.array(z.string().regex(/^(shared|user:[0-9a-f-]{36})$/)).min(1),
});

/**
 * Salin anggaran bulan sebelumnya ke `month` untuk pemilik yang diminta; yang sudah ada tidak ditimpa.
 * Dipakai tombol "Salin anggaran bulan lalu" dan nanti job tanggal 1 (DATA-MODEL budgets).
 */
export async function copyBudgetsFromPreviousMonth(
  viewer: Viewer,
  input: z.input<typeof copySchema>,
  db: DbOrTx = defaultDb,
): Promise<{ copied: number }> {
  const { month, scopeOwners } = parseInput(copySchema, input);
  const previous = addMonthsKey(month, -1, 1);
  return inTransaction(db, async (tx) => {
    const [source, existing] = await Promise.all([
      tx
        .select()
        .from(budgets)
        .where(and(eq(budgets.month, previous), isNull(budgets.deletedAt), inArray(budgets.scopeOwner, scopeOwners))),
      tx
        .select({ scopeOwner: budgets.scopeOwner, categoryId: budgets.categoryId })
        .from(budgets)
        .where(and(eq(budgets.month, month), isNull(budgets.deletedAt), inArray(budgets.scopeOwner, scopeOwners))),
    ]);
    const taken = new Set(existing.map((b) => `${b.scopeOwner}:${b.categoryId}`));
    let copied = 0;
    for (const b of source) {
      if (taken.has(`${b.scopeOwner}:${b.categoryId}`)) continue;
      await upsertBudget(
        viewer,
        { scopeOwner: b.scopeOwner, categoryId: b.categoryId, month, amount: b.amount, isMandatory: b.isMandatory },
        tx,
      );
      copied++;
    }
    return { copied };
  });
}
