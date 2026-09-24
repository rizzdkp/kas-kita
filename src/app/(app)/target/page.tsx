import type { Metadata } from "next";
import { planningPeople } from "@/components/budgets/people";
import { GoalsView } from "@/components/goals/goals-view";
import { isAchieved, type GoalItem } from "@/components/goals/types";
import { todayJakarta } from "@/lib/dates";
import { parseScope } from "@/lib/scope";
import { requireViewer } from "@/server/auth/session";
import { listAccounts } from "@/server/queries/accounts";
import { listGoals } from "@/server/queries/goals";
import { listGoalContributions } from "@/server/queries/planning-history";

export const metadata: Metadata = { title: "Target" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TargetPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const scope = viewer.partner ? parseScope(params.scope) : "me";
  const today = todayJakarta();

  const [goals, accounts] = await Promise.all([listGoals(viewer, scope, { today }), listAccounts(viewer, { scope: "all" })]);
  const all = [...goals.active, ...goals.achieved];
  const contributions = await listGoalContributions(all.filter((g) => !g.linkedAccountId).map((g) => g.id));
  const items: GoalItem[] = all.map((g) => ({ ...g, contributions: contributions.get(g.id) ?? [] }));

  return (
    <GoalsView
      scope={scope}
      people={planningPeople(viewer)}
      active={items.filter((g) => !isAchieved(g))}
      achieved={items.filter(isAchieved)}
      accounts={[...accounts.liquid, ...accounts.asset].map((a) => ({ id: a.id, label: a.name }))}
      today={today}
    />
  );
}
