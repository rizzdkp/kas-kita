import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { budgets } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { monthStartKey } from "@/server/metrics/_time";
import { budgetOwnerIdFromKey } from "@/server/queries/scope";
import { amountSchema, dateKeySchema, inTransaction, parseInput, versionSchema } from "./_shared";
import { insertWithAudit, restoreWithAudit, softDeleteWithAudit, updateWithAudit } from "./audit";
import { notifyOwners } from "./notify";

export type BudgetRow = typeof budgets.$inferSelect;

const upsertBudgetSchema = z.object({
  /** "user:<uuid>" atau "shared". */
  scopeOwner: z.string().regex(/^(shared|user:[0-9a-f-]{36})$/),
  categoryId: z.uuid(),
  month: dateKeySchema.transform(monthStartKey),
  amount: amountSchema,
  isMandatory: z.boolean().default(false),
  /** Versi yang terakhir dilihat; wajib kalau anggaran sudah ada supaya edit bersamaan terdeteksi. */
  version: versionSchema.optional(),
});

/** Satu anggaran per (pemilik, kategori, bulan): insert kalau belum ada, update kalau sudah. */
export async function upsertBudget(viewer: Viewer, input: z.input<typeof upsertBudgetSchema>, db: DbOrTx = defaultDb): Promise<BudgetRow> {
  const { version, ...data } = parseInput(upsertBudgetSchema, input);
  const ownerId = budgetOwnerIdFromKey(data.scopeOwner);
  if (ownerId && ownerId !== viewer.user.id && ownerId !== viewer.partner?.id) {
    throw new ValidationError("Pemilik anggaran tidak dikenal");
  }
  return inTransaction(db, async (tx) => {
    const [existing] = await tx
      .select()
      .from(budgets)
      .where(and(eq(budgets.scopeOwner, data.scopeOwner), eq(budgets.categoryId, data.categoryId), eq(budgets.month, data.month)));
    if (!existing) return insertWithAudit(tx, budgets, data, viewer.user.id);

    let expectedVersion = version ?? existing.version;
    if (existing.deletedAt) {
      expectedVersion = (await restoreWithAudit(tx, budgets, { id: existing.id, expectedVersion, actorId: viewer.user.id })).after.version;
    }
    const result = await updateWithAudit(tx, budgets, {
      id: existing.id,
      expectedVersion,
      actorId: viewer.user.id,
      values: { amount: data.amount, isMandatory: data.isMandatory },
    });
    if (Object.keys(result.diff).length > 0) {
      await notifyOwners(tx, {
        ownerIds: [ownerId],
        actor: viewer.user,
        entity: "budgets",
        entityId: existing.id,
        action: "update",
        label: "Anggaran",
        diff: result.diff,
      });
    }
    return result.after;
  });
}

export async function deleteBudget(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<BudgetRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const result = await softDeleteWithAudit(tx, budgets, { id, expectedVersion: version, actorId: viewer.user.id });
    await notifyOwners(tx, {
      ownerIds: [budgetOwnerIdFromKey(result.after.scopeOwner)],
      actor: viewer.user,
      entity: "budgets",
      entityId: id,
      action: "delete",
      label: "Anggaran",
      diff: result.diff,
    });
    return result.after;
  });
}
