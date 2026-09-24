"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { listSurface } from "@/components/budgets/meter-bar";
import type { Option } from "@/components/budgets/options";
import { choiceFromScope, type PlanningPeople } from "@/components/budgets/owner";
import { useActionRunner } from "@/components/budgets/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { Scope } from "@/lib/scope";
import { deleteGoalAction, setGoalAchievedAction } from "@/server/actions/goals";
import { AchievedSection } from "./achieved-section";
import { ContributeDialog } from "./contribute-dialog";
import { ContributionHistorySheet } from "./contribution-history";
import { GoalRow } from "./goal-row";
import { GoalSheet } from "./goal-sheet";
import type { GoalItem } from "./types";

type GoalsViewProps = {
  scope: Scope;
  people: PlanningPeople;
  active: GoalItem[];
  achieved: GoalItem[];
  accounts: Option[];
  today: string;
};

type Panel =
  | { kind: "new" }
  | { kind: "edit"; goal: GoalItem }
  | { kind: "history"; goal: GoalItem }
  | { kind: "contribute"; goal: GoalItem }
  | { kind: "delete"; goal: GoalItem }
  | null;

export function GoalsView({ scope, people, active, achieved, accounts, today }: GoalsViewProps) {
  const toast = useToast();
  const mutate = useActionRunner();
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);
  const sheetOpen = panel?.kind === "new" || panel?.kind === "edit" || panel?.kind === "history";
  const dialogOpen = panel?.kind === "contribute" || panel?.kind === "delete";

  function markAchieved(goal: GoalItem, achievedFlag: boolean) {
    mutate.run(
      () => setGoalAchievedAction({ id: goal.id, version: goal.version, achieved: achievedFlag }),
      () => toast.show({ title: achievedFlag ? `Target ${goal.name} tercapai` : `${goal.name} ditandai belum tercapai` }),
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {active.length === 0 ? (
        <Card>
          <EmptyState
            title={achieved.length > 0 ? "Semua target sudah tercapai" : "Buat target tabungan pertama"}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setPanel({ kind: "new" })}>
                Tambah target
              </Button>
            }
          >
            Misalnya dana darurat atau liburan. Beri tenggat supaya Kas Kita menghitung setoran bulanan yang dibutuhkan.
          </EmptyState>
        </Card>
      ) : (
        <section aria-labelledby="target-aktif" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="target-aktif" className="text-card text-primary">
              Target aktif <span className="font-normal text-secondary">({active.length})</span>
            </h2>
            <Button variant="primary" icon={Plus} onClick={() => setPanel({ kind: "new" })}>
              Tambah target
            </Button>
          </div>
          <ul className={`${listSurface} divide-y divide-border`}>
            {active.map((g) => (
              <li key={g.id}>
                <GoalRow
                  goal={g}
                  people={people}
                  today={today}
                  onContribute={() => setPanel({ kind: "contribute", goal: g })}
                  onEdit={() => setPanel({ kind: "edit", goal: g })}
                  onHistory={() => setPanel({ kind: "history", goal: g })}
                  onAchieved={() => markAchieved(g, true)}
                  onDelete={() => setPanel({ kind: "delete", goal: g })}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {mutate.error && panel?.kind !== "delete" ? (
        <p role="alert" className="text-small text-error">
          {mutate.error}
        </p>
      ) : null}

      <AchievedSection
        goals={achieved}
        people={people}
        onReopen={(g) => markAchieved(g, false)}
        onDelete={(g) => setPanel({ kind: "delete", goal: g })}
      />

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && close()}>
        {panel?.kind === "history" ? <ContributionHistorySheet goal={panel.goal} /> : null}
        {panel?.kind === "new" || panel?.kind === "edit" ? (
          <GoalSheet
            key={panel.kind === "edit" ? panel.goal.id : "new"}
            goal={panel.kind === "edit" ? panel.goal : undefined}
            people={people}
            initialOwner={choiceFromScope(scope, people)}
            accounts={accounts}
            today={today}
            onDone={close}
          />
        ) : null}
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && close()}>
        {panel?.kind === "contribute" ? <ContributeDialog goal={panel.goal} today={today} onDone={close} /> : null}
        {panel?.kind === "delete" ? (
          <DialogContent
            title={`Hapus target ${panel.goal.name}?`}
            description={
              panel.goal.linkedAccountId
                ? "Akun penampung dan saldonya tidak ikut terhapus."
                : "Riwayat setorannya ikut tersembunyi bersama target ini."
            }
            footer={
              <>
                <Button onClick={close}>Batal</Button>
                <Button
                  variant="danger"
                  loading={mutate.pending}
                  onClick={() =>
                    mutate.run(
                      () => deleteGoalAction({ id: panel.goal.id, version: panel.goal.version }),
                      () => {
                        toast.show({ title: "Terhapus" });
                        close();
                      },
                    )
                  }
                >
                  Hapus target
                </Button>
              </>
            }
          >
            {mutate.error ? (
              <p role="alert" className="text-small text-error">
                {mutate.error}
              </p>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
