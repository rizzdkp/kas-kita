import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { goalContributions, goals } from "@/server/db/schema";
import { DomainError, NotFoundError } from "@/server/errors";
import { amountSchema, dateKeySchema, inTransaction, parseInput, versionSchema, pickProvided } from "./_shared";
import { insertWithAudit, softDeleteWithAudit, updateWithAudit } from "./audit";
import { notifyOwners } from "./notify";

export type GoalRow = typeof goals.$inferSelect;
export type GoalContributionRow = typeof goalContributions.$inferSelect;

const goalFieldsSchema = z.object({
  name: z.string().trim().min(1, "Isi nama target").max(80),
  ownerId: z.uuid().nullable(),
  targetAmount: amountSchema,
  deadline: dateKeySchema.nullish().transform((v) => v ?? null),
  linkedAccountId: z.uuid().nullish().transform((v) => v ?? null),
});

export async function createGoal(viewer: Viewer, input: z.input<typeof goalFieldsSchema>, db: DbOrTx = defaultDb): Promise<GoalRow> {
  const data = parseInput(goalFieldsSchema, input);
  return inTransaction(db, (tx) => insertWithAudit(tx, goals, data, viewer.user.id));
}

const updateGoalSchema = z.object({ id: z.uuid(), version: versionSchema, patch: goalFieldsSchema.partial() });

export async function updateGoal(viewer: Viewer, input: z.input<typeof updateGoalSchema>, db: DbOrTx = defaultDb): Promise<GoalRow> {
  const parsed = parseInput(updateGoalSchema, input);
  const { id, version } = parsed;
  const patch = pickProvided(parsed.patch, (input as { patch?: unknown }).patch);
  return inTransaction(db, async (tx) => {
    const result = await updateWithAudit(tx, goals, { id, expectedVersion: version, actorId: viewer.user.id, values: patch });
    if (Object.keys(result.diff).length > 0) {
      await notifyOwners(tx, {
        ownerIds: [result.before.ownerId, result.after.ownerId],
        actor: viewer.user,
        entity: "goals",
        entityId: id,
        action: "update",
        label: result.after.name,
        diff: result.diff,
      });
    }
    return result.after;
  });
}

/** Tandai tercapai (atau batalkan); target tercapai pindah ke bagian "Tercapai" (F-GOAL-1 AC3). */
export async function setGoalAchieved(
  viewer: Viewer,
  input: { id: string; version: number; achieved: boolean },
  db: DbOrTx = defaultDb,
): Promise<GoalRow> {
  const { id, version, achieved } = parseInput(z.object({ id: z.uuid(), version: versionSchema, achieved: z.boolean() }), input);
  return inTransaction(db, async (tx) => {
    const values = { achievedAt: achieved ? new Date() : null };
    return (await updateWithAudit(tx, goals, { id, expectedVersion: version, actorId: viewer.user.id, values })).after;
  });
}

export async function deleteGoal(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<GoalRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const result = await softDeleteWithAudit(tx, goals, { id, expectedVersion: version, actorId: viewer.user.id });
    await notifyOwners(tx, {
      ownerIds: [result.after.ownerId],
      actor: viewer.user,
      entity: "goals",
      entityId: id,
      action: "delete",
      label: result.after.name,
      diff: result.diff,
    });
    return result.after;
  });
}

const contributeSchema = z.object({
  goalId: z.uuid(),
  amount: amountSchema,
  contributedAt: z.coerce.date().optional(),
});

/** Setoran manual untuk target tanpa akun penampung; target dengan akun penampung diisi lewat transfer. */
export async function contributeToGoal(
  viewer: Viewer,
  input: z.input<typeof contributeSchema>,
  db: DbOrTx = defaultDb,
): Promise<GoalContributionRow> {
  const data = parseInput(contributeSchema, input);
  return inTransaction(db, async (tx) => {
    const [goal] = await tx.select().from(goals).where(eq(goals.id, data.goalId));
    if (!goal || goal.deletedAt) throw new NotFoundError("goals", data.goalId);
    if (goal.linkedAccountId) {
      throw new DomainError("goal_has_account", "Target ini punya akun penampung. Catat setoran sebagai transfer ke akun itu.");
    }
    return insertWithAudit(
      tx,
      goalContributions,
      { goalId: goal.id, amount: data.amount, contributedAt: data.contributedAt ?? new Date(), createdBy: viewer.user.id },
      viewer.user.id,
    );
  });
}

export async function deleteGoalContribution(
  viewer: Viewer,
  input: { id: string; version: number },
  db: DbOrTx = defaultDb,
): Promise<GoalContributionRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => (await softDeleteWithAudit(tx, goalContributions, { id, expectedVersion: version, actorId: viewer.user.id })).after);
}
