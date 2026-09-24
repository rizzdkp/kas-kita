"use client";

import { useState, type ReactNode } from "react";
import { Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogContent, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { Scope } from "@/lib/scope";
import { copyPreviousBudgetsAction, deleteBudgetAction } from "@/server/actions/budgets";
import type { BudgetWithStatus } from "@/server/queries/budgets";
import { BudgetRowContent } from "./budget-row";
import { BudgetSheet, budgetKey, type CategoryOption } from "./budget-sheet";
import { listSurface } from "./meter-bar";
import { choiceFromScope, ownerName, OwnerDot, type PlanningPeople } from "./owner";
import { useActionRunner } from "./use-action";

type BudgetsViewProps = {
  month: string;
  isCurrentMonth: boolean;
  scope: Scope;
  people: PlanningPeople;
  budgets: BudgetWithStatus[];
  categories: CategoryOption[];
  /** Label bulan sebelumnya kalau bulan itu punya anggaran yang bisa disalin. */
  copyFromLabel: string | null;
  nav: ReactNode;
  summary: ReactNode;
};

type SheetState = { mode: "new" } | { mode: "edit"; budget: BudgetWithStatus } | null;

function groupByOwner(budgets: BudgetWithStatus[], people: PlanningPeople) {
  const order = [people.me.id, people.partner?.id ?? "", null];
  return order
    .map((ownerId) => ({ ownerId, items: budgets.filter((b) => b.ownerId === ownerId) }))
    .filter((g) => g.items.length > 0);
}

export function BudgetsView({ month, isCurrentMonth, scope, people, budgets, categories, copyFromLabel, nav, summary }: BudgetsViewProps) {
  const toast = useToast();
  const copy = useActionRunner();
  const remove = useActionRunner();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [confirmDelete, setConfirmDelete] = useState<BudgetWithStatus | null>(null);
  const taken = budgets.map((b) => budgetKey(b.ownerId, b.categoryId));
  const groups = scope === "all" ? groupByOwner(budgets, people) : [{ ownerId: undefined, items: budgets }];

  function copyPrevious() {
    copy.run(
      () => copyPreviousBudgetsAction({ month: `${month}-01`, scope }),
      (data) => toast.show({ title: data.copied > 0 ? `${data.copied} anggaran disalin` : "Tidak ada anggaran yang perlu disalin" }),
    );
  }

  const copyButton =
    copyFromLabel && budgets.length === 0 ? (
      <Button icon={Copy} onClick={copyPrevious} loading={copy.pending}>
        Salin anggaran {copyFromLabel}
      </Button>
    ) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {nav}
        {budgets.length > 0 ? (
          <Button variant="primary" icon={Plus} onClick={() => setSheet({ mode: "new" })}>
            Tambah anggaran
          </Button>
        ) : null}
      </div>

      {budgets.length === 0 ? (
        <Card>
          <EmptyState
            title={isCurrentMonth ? "Atur anggaran bulan ini" : "Belum ada anggaran di bulan ini"}
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setSheet({ mode: "new" })}>
                  Buat anggaran
                </Button>
                {copyButton}
              </div>
            }
          >
            {isCurrentMonth
              ? "Mulai dari dua atau tiga kategori terbesar. Anggaran bulan depan menyalin bulan ini."
              : "Salin anggaran bulan sebelumnya, atau mulai dari dua atau tiga kategori terbesar."}
          </EmptyState>
          {copy.error ? (
            <p role="alert" className="text-small text-error">
              {copy.error}
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          {summary}
          {groups.map((group) => (
            <section key={group.ownerId ?? "shared"} aria-label={group.ownerId === undefined ? "Anggaran" : `Anggaran ${ownerName(group.ownerId, people)}`}>
              {group.ownerId !== undefined ? (
                <h2 className="mb-3 flex items-center gap-2 text-card text-primary">
                  <OwnerDot ownerId={group.ownerId} people={people} />
                  {ownerName(group.ownerId, people)}
                </h2>
              ) : null}
              <div className={listSurface}>
                <ul className="divide-y divide-border">
                  {group.items.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        aria-label={`Ubah anggaran ${b.categoryName}`}
                        onClick={() => setSheet({ mode: "edit", budget: b })}
                        className="block w-full px-4 py-4 transition-colors duration-(--dur-fast) hover:bg-surface-sunken sm:px-5"
                      >
                        <BudgetRowContent budget={b} showToday={isCurrentMonth} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </>
      )}

      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        {sheet ? (
          <BudgetSheet
            key={sheet.mode === "edit" ? sheet.budget.id : "new"}
            month={month}
            people={people}
            categories={categories}
            taken={taken}
            initialOwner={choiceFromScope(scope, people)}
            budget={sheet.mode === "edit" ? sheet.budget : undefined}
            onDone={() => setSheet(null)}
            onDelete={
              sheet.mode === "edit"
                ? () => {
                    setConfirmDelete(sheet.budget);
                    setSheet(null);
                  }
                : undefined
            }
          />
        ) : null}
      </Sheet>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        {confirmDelete ? (
          <DialogContent
            title={`Hapus anggaran ${confirmDelete.categoryName}?`}
            description="Transaksinya tidak ikut terhapus. Kamu bisa membuat anggaran ini lagi kapan saja."
            footer={
              <>
                <Button onClick={() => setConfirmDelete(null)}>Batal</Button>
                <Button
                  variant="danger"
                  loading={remove.pending}
                  onClick={() =>
                    remove.run(
                      () => deleteBudgetAction({ id: confirmDelete.id, version: confirmDelete.version }),
                      () => {
                        toast.show({ title: "Terhapus" });
                        setConfirmDelete(null);
                      },
                    )
                  }
                >
                  Hapus anggaran
                </Button>
              </>
            }
          >
            {remove.error ? (
              <p role="alert" className="text-small text-error">
                {remove.error}
              </p>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
