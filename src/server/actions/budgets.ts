"use server";

import { z } from "zod";
import { parseScope } from "@/lib/scope";
import { requireViewer } from "@/server/auth/session";
import { type ActionResult, runAction } from "@/server/actions/result";
import { copyBudgetsFromPreviousMonth } from "@/server/mutations/budget-copy";
import { deleteBudget, upsertBudget } from "@/server/mutations/budgets";
import { amountSchema, dateKeySchema, parseInput, versionSchema } from "@/server/mutations/_shared";
import { budgetOwnerKey, scopeOwnerIds } from "@/server/queries/scope";

const saveSchema = z.object({
  scopeOwner: z.string(),
  categoryId: z.string(),
  month: dateKeySchema,
  amount: amountSchema,
  isMandatory: z.boolean(),
  version: versionSchema.optional(),
});

export async function saveBudgetAction(input: z.input<typeof saveSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(saveSchema, input);
    const row = await upsertBudget(viewer, data);
    return { id: row.id };
  });
}

const deleteSchema = z.object({ id: z.string(), version: versionSchema });

export async function deleteBudgetAction(input: z.input<typeof deleteSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await deleteBudget(viewer, parseInput(deleteSchema, input));
    return { id: row.id };
  });
}

const copySchema = z.object({ month: dateKeySchema, scope: z.string() });

/** Pemilik yang disalin mengikuti cakupan: Gabungan ikut menyalin anggaran Bersama. */
export async function copyPreviousBudgetsAction(input: z.input<typeof copySchema>): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(copySchema, input);
    const scope = parseScope(data.scope);
    const owners = scopeOwnerIds(viewer, scope);
    const scopeOwners = [...owners.ownerIds.map((id) => budgetOwnerKey(id)), ...(owners.all ? [budgetOwnerKey(null)] : [])];
    return copyBudgetsFromPreviousMonth(viewer, { month: data.month, scopeOwners });
  });
}
