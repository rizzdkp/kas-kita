"use server";

import { z } from "zod";
import { todayJakarta } from "@/lib/dates";
import { requireViewer } from "@/server/auth/session";
import { type ActionResult, runAction } from "@/server/actions/result";
import { startOfKey } from "@/server/metrics/_time";
import { contributeToGoal, createGoal, deleteGoal, deleteGoalContribution, setGoalAchieved, updateGoal } from "@/server/mutations/goals";
import { amountSchema, dateKeySchema, parseInput, versionSchema } from "@/server/mutations/_shared";
import { listGoals } from "@/server/queries/goals";

const NOON_MS = 12 * 60 * 60 * 1000;

const fieldsSchema = z.object({
  name: z.string(),
  ownerId: z.string().nullable(),
  targetAmount: amountSchema,
  deadline: dateKeySchema.nullable(),
  linkedAccountId: z.string().nullable(),
});

export type GoalFieldsInput = z.input<typeof fieldsSchema>;

export async function createGoalAction(input: GoalFieldsInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await createGoal(viewer, parseInput(fieldsSchema, input));
    return { id: row.id };
  });
}

const updateSchema = z.object({ id: z.string(), version: versionSchema, fields: fieldsSchema });

export async function updateGoalAction(input: z.input<typeof updateSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { id, version, fields } = parseInput(updateSchema, input);
    const row = await updateGoal(viewer, { id, version, patch: fields });
    return { id: row.id };
  });
}

const idVersionSchema = z.object({ id: z.string(), version: versionSchema });

export async function deleteGoalAction(input: z.input<typeof idVersionSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await deleteGoal(viewer, parseInput(idVersionSchema, input));
    return { id: row.id };
  });
}

const achievedSchema = z.object({ id: z.string(), version: versionSchema, achieved: z.boolean() });

export async function setGoalAchievedAction(input: z.input<typeof achievedSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await setGoalAchieved(viewer, parseInput(achievedSchema, input));
    return { id: row.id };
  });
}

const contributeSchema = z.object({ goalId: z.string(), amount: amountSchema, contributedOn: dateKeySchema });

/** Setoran manual; kalau progres sudah mencapai nominal target, target langsung ditandai tercapai (F-GOAL-1 AC3). */
export async function contributeToGoalAction(
  input: z.input<typeof contributeSchema>,
): Promise<ActionResult<{ achieved: boolean }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(contributeSchema, input);
    const now = new Date();
    const contributedAt = data.contributedOn === todayJakarta(now) ? now : new Date(startOfKey(data.contributedOn).getTime() + NOON_MS);
    await contributeToGoal(viewer, { goalId: data.goalId, amount: data.amount, contributedAt });
    const { active, achieved } = await listGoals(viewer, "all", { today: todayJakarta(now) });
    // listGoals sudah memindahkan target yang progresnya penuh ke achieved, jadi cari di keduanya
    const goal = [...active, ...achieved].find((g) => g.id === data.goalId);
    if (goal && goal.achievedAt === null && goal.progress >= goal.targetAmount) {
      await setGoalAchieved(viewer, { id: goal.id, version: goal.version, achieved: true });
      return { achieved: true };
    }
    return { achieved: false };
  });
}

export async function deleteContributionAction(input: z.input<typeof idVersionSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await deleteGoalContribution(viewer, parseInput(idVersionSchema, input));
    return { id: row.id };
  });
}
