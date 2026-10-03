"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { listSurface } from "@/components/budgets/meter-bar";
import { useActionRunner } from "@/components/budgets/use-action";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { Scope } from "@/lib/scope";
import { deleteRecurringRuleAction } from "@/server/actions/recurring";
import type { RecurringRuleItem } from "@/server/queries/recurring";
import type { RecurringInitial } from "./form-model";
import { RecurringRow } from "./recurring-row";
import { RecurringSheet } from "./recurring-sheet";

type RecurringViewProps = {
  scope: Scope;
  rules: RecurringRuleItem[];
  options: TransactionFormOptions;
  today: string;
  /** Isian dari "Jadikan berulang" di detail transaksi; sheet langsung terbuka. */
  prefill: RecurringInitial | null;
};

type Panel = { kind: "new"; initial?: RecurringInitial } | { kind: "edit"; rule: RecurringRuleItem } | { kind: "delete"; rule: RecurringRuleItem } | null;

function initialFromRule(rule: RecurringRuleItem): RecurringInitial {
  return { ...rule.template, amount: rule.amount, frequency: rule.frequency, interval: rule.interval, nextRunOn: rule.nextRunOn, autoConfirm: rule.autoConfirm };
}

export function RecurringView({ scope, rules, options, today, prefill }: RecurringViewProps) {
  const router = useRouter();
  const toast = useToast();
  const remove = useActionRunner();
  const [panel, setPanel] = useState<Panel>(prefill ? { kind: "new", initial: prefill } : null);
  const close = () => {
    setPanel(null);
    remove.reset();
    // ?dari= hanya untuk membuka sheet sekali; dibuang supaya muat ulang tidak membukanya lagi
    if (prefill) router.replace(scope === "me" ? "/transaksi/berulang" : `/transaksi/berulang?scope=${scope}`, { scroll: false });
  };
  const add = () => setPanel({ kind: "new" });

  return (
    <div className="flex flex-col gap-6">
      {rules.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum ada transaksi berulang"
            action={
              <Button variant="primary" icon={Plus} onClick={add}>
                Tambah transaksi berulang
              </Button>
            }
          >
            Gaji, sewa, langganan, atau kiriman rutin. Kas Kita membuatnya pada tanggalnya dan menaruhnya di Perlu dikonfirmasi, atau langsung mencatatnya kalau konfirmasi otomatis dinyalakan.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[60ch] text-body text-secondary">
              Dibuat pada tanggalnya. Yang tanpa konfirmasi otomatis menunggu di Perlu dikonfirmasi sampai kamu mengonfirmasinya.
            </p>
            <Button variant="primary" icon={Plus} onClick={add}>
              Tambah transaksi berulang
            </Button>
          </div>
          <ul aria-label="Daftar transaksi berulang" className={`${listSurface} divide-y divide-border`}>
            {rules.map((rule) => (
              <li key={rule.id}>
                <RecurringRow
                  rule={rule}
                  people={options.people}
                  today={today}
                  onEdit={() => setPanel({ kind: "edit", rule })}
                  onDelete={() => setPanel({ kind: "delete", rule })}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={panel?.kind === "new" || panel?.kind === "edit"} onOpenChange={(open) => !open && close()}>
        {panel?.kind === "new" || panel?.kind === "edit" ? (
          <RecurringSheet
            key={panel.kind === "edit" ? `${panel.rule.id}:${panel.rule.version}` : "new"}
            editing={panel.kind === "edit" ? { id: panel.rule.id, version: panel.rule.version, label: panel.rule.label } : undefined}
            initial={panel.kind === "edit" ? initialFromRule(panel.rule) : panel.initial}
            options={options}
            scope={scope}
            today={today}
            onDone={close}
          />
        ) : null}
      </Sheet>

      <Dialog open={panel?.kind === "delete"} onOpenChange={(open) => !open && close()}>
        {panel?.kind === "delete" ? (
          <DialogContent
            title={`Hapus jadwal ${panel.rule.label}?`}
            description="Transaksi yang sudah dibuat dari jadwal ini tetap tersimpan."
            footer={
              <>
                <Button onClick={close}>Batal</Button>
                <Button
                  variant="danger"
                  loading={remove.pending}
                  onClick={() =>
                    remove.run(
                      () => deleteRecurringRuleAction({ id: panel.rule.id, version: panel.rule.version }),
                      () => {
                        toast.show({ title: "Terhapus" });
                        close();
                      },
                    )
                  }
                >
                  Hapus jadwal
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
