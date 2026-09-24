import { goalReached } from "@/lib/goals";
import type { GoalWithProgress } from "@/server/queries/goals";
import type { GoalContributionEntry } from "@/server/queries/planning-history";

export type GoalItem = GoalWithProgress & { contributions: GoalContributionEntry[] };

/** Tercapai kalau sudah ditandai, atau progresnya sudah menyentuh nominal target (F-GOAL-1 AC3). */
export function isAchieved(goal: Pick<GoalWithProgress, "achievedAt" | "progress" | "targetAmount">): boolean {
  return goalReached(goal.achievedAt, goal.progress, goal.targetAmount);
}
