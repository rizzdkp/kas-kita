import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, goalContributions, goals } from "@/server/db/schema";
import { startOfKey } from "@/server/metrics/_time";
import { sumTransfersInto } from "./aggregates";
import { getAccountBalances } from "./balances";
import { ownerInScope } from "./scope";

export interface GoalWithProgress {
  id: string;
  ownerId: string | null;
  name: string;
  targetAmount: bigint;
  deadline: string | null;
  linkedAccountId: string | null;
  linkedAccountName: string | null;
  achievedAt: Date | null;
  version: number;
  /** Dari saldo akun penampung, atau dari setoran manual (F-GOAL-1 AC1). */
  progress: bigint;
  remaining: bigint;
  progressPercent: number;
  /** Setoran bulanan yang dibutuhkan untuk mencapai tenggat (AC2); null tanpa tenggat. */
  requiredMonthly: bigint | null;
  monthsLeft: number | null;
  /** Setoran sejak `contributedSince` (dipakai Aman dibelanjakan). */
  contributedSince: bigint;
}

export function monthsUntil(today: string, deadline: string): number {
  const [y1, m1] = today.split("-").map(Number) as [number, number];
  const [y2, m2] = deadline.split("-").map(Number) as [number, number];
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

export async function listGoals(
  viewer: Viewer,
  scope: Scope,
  opts: { today: string; contributedSince?: string },
  db: DbOrTx = defaultDb,
): Promise<{ active: GoalWithProgress[]; achieved: GoalWithProgress[] }> {
  const rows = await db
    .select({
      id: goals.id,
      ownerId: goals.ownerId,
      name: goals.name,
      targetAmount: goals.targetAmount,
      deadline: goals.deadline,
      linkedAccountId: goals.linkedAccountId,
      linkedAccountName: accounts.name,
      achievedAt: goals.achievedAt,
      version: goals.version,
    })
    .from(goals)
    .leftJoin(accounts, eq(accounts.id, goals.linkedAccountId))
    .where(and(isNull(goals.deletedAt), ownerInScope(goals.ownerId, viewer, scope)))
    .orderBy(asc(goals.deadline), asc(goals.name));
  if (rows.length === 0) return { active: [], achieved: [] };

  const linkedIds = rows.flatMap((r) => (r.linkedAccountId ? [r.linkedAccountId] : []));
  const manualIds = rows.filter((r) => !r.linkedAccountId).map((r) => r.id);
  const since = startOfKey(opts.contributedSince ?? opts.today);
  const [balances, linkedSince, manual] = await Promise.all([
    getAccountBalances({ accountIds: linkedIds }, db),
    sumTransfersInto(linkedIds, { start: since, end: new Date("9999-12-31T00:00:00Z") }, db),
    manualIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            goalId: goalContributions.goalId,
            total: sql<bigint>`sum(${goalContributions.amount})::bigint`,
            since: sql<bigint>`coalesce(sum(${goalContributions.amount}) filter (where ${gte(goalContributions.contributedAt, since)}), 0)::bigint`,
          })
          .from(goalContributions)
          .where(and(inArray(goalContributions.goalId, manualIds), isNull(goalContributions.deletedAt)))
          .groupBy(goalContributions.goalId),
  ]);

  const list = rows.map((g): GoalWithProgress => {
    const m = manual.find((x) => x.goalId === g.id);
    const progress = g.linkedAccountId ? (balances.get(g.linkedAccountId) ?? 0n) : BigInt(m?.total ?? 0n);
    const contributedSince = g.linkedAccountId ? (linkedSince.get(g.linkedAccountId) ?? 0n) : BigInt(m?.since ?? 0n);
    const remaining = g.targetAmount > progress ? g.targetAmount - progress : 0n;
    const monthsLeft = g.deadline ? monthsUntil(opts.today, g.deadline) : null;
    return {
      ...g,
      progress,
      remaining,
      progressPercent: g.targetAmount > 0n ? Math.max(0, Math.min(100, Number((progress * 1000n) / g.targetAmount) / 10)) : 0,
      monthsLeft,
      requiredMonthly: monthsLeft !== null && !g.achievedAt ? ceilDiv(remaining, BigInt(monthsLeft)) : null,
      contributedSince,
    };
  });
  return { active: list.filter((g) => !g.achievedAt), achieved: list.filter((g) => g.achievedAt) };
}
