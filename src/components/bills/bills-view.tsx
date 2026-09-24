"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { listSurface } from "@/components/budgets/meter-bar";
import type { Option } from "@/components/budgets/options";
import { choiceFromScope, OwnerDot, type PlanningPeople } from "@/components/budgets/owner";
import { useActionRunner } from "@/components/budgets/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatShortDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { deleteBillAction } from "@/server/actions/bills";
import { BillHistorySheet } from "./bill-history";
import { BillRow } from "./bill-row";
import { BillSheet } from "./bill-sheet";
import { PayDialog } from "./pay-dialog";
import type { AccountOption, BillItem, PaidItem } from "./types";

type BillsViewProps = {
  scope: Scope;
  people: PlanningPeople;
  bills: BillItem[];
  paid: PaidItem[];
  periodLabel: string;
  /** Hari terakhir periode (kunci hari) untuk ringkasan jatuh tempo. */
  periodLast: string;
  payAccounts: AccountOption[];
  cardAccounts: AccountOption[];
  categories: Option[];
  today: string;
};

type Panel =
  | { kind: "new" }
  | { kind: "edit"; bill: BillItem }
  | { kind: "history"; bill: BillItem }
  | { kind: "pay"; bill: BillItem }
  | { kind: "delete"; bill: BillItem }
  | null;

export function BillsView(props: BillsViewProps) {
  const { people, bills, paid, periodLabel, periodLast } = props;
  const toast = useToast();
  const remove = useActionRunner();
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  const duePeriod = bills.filter((b) => b.nextDueOn <= periodLast);
  const dueTotal = duePeriod.reduce((sum, b) => sum + b.amount, 0n);
  const overdue = bills.filter((b) => b.overdue).length;
  const sheetOpen = panel?.kind === "new" || panel?.kind === "edit" || panel?.kind === "history";
  const dialogOpen = panel?.kind === "pay" || panel?.kind === "delete";

  return (
    <div className="flex flex-col gap-8">
      {bills.length === 0 ? (
        <Card>
          <EmptyState
            title="Catat tagihan rutin"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setPanel({ kind: "new" })}>
                Tambah tagihan
              </Button>
            }
          >
            Listrik, internet, sewa, atau kartu kredit. Kas Kita menghitung mundur jatuh temponya dan memasukkannya ke Aman dibelanjakan.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-small text-secondary">Jatuh tempo sampai akhir periode ({periodLabel})</p>
              <p className="tabular text-large text-primary">{formatRupiah(dueTotal)}</p>
              <p className="text-small text-secondary">
                {duePeriod.length} tagihan belum dibayar
                {overdue > 0 ? <span className="text-attention"> · {overdue} telat</span> : null}
              </p>
            </div>
            <Button variant="primary" icon={Plus} onClick={() => setPanel({ kind: "new" })}>
              Tambah tagihan
            </Button>
          </div>

          <section aria-labelledby="tagihan-berikutnya">
            <h2 id="tagihan-berikutnya" className="mb-3 text-card text-primary">
              Berikutnya
            </h2>
            <ul className={`${listSurface} divide-y divide-border`}>
              {bills.map((b) => (
                <li key={b.id}>
                  <BillRow
                    bill={b}
                    people={people}
                    onPay={() => setPanel({ kind: "pay", bill: b })}
                    onEdit={() => setPanel({ kind: "edit", bill: b })}
                    onHistory={() => setPanel({ kind: "history", bill: b })}
                    onDelete={() => setPanel({ kind: "delete", bill: b })}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section aria-labelledby="lunas-periode">
        <h2 id="lunas-periode" className="mb-3 text-card text-primary">
          Lunas periode ini <span className="font-normal text-secondary">· {periodLabel}</span>
        </h2>
        {paid.length === 0 ? (
          <p className="text-body text-secondary">Belum ada tagihan yang dibayar di periode ini.</p>
        ) : (
          <ul className={`${listSurface} divide-y divide-border`}>
            {paid.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-body text-primary">
                    <OwnerDot ownerId={p.ownerId} people={people} />
                    {p.billName}
                  </span>
                  <span className="text-small text-secondary">
                    Dibayar {formatShortDate(p.paidAt)}
                    {p.accountName ? ` dari ${p.accountName}` : ""}
                  </span>
                </span>
                <span className="tabular shrink-0 whitespace-nowrap text-body text-primary">{p.amount === null ? "" : formatRupiah(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && close()}>
        {panel?.kind === "history" ? <BillHistorySheet bill={panel.bill} /> : null}
        {panel?.kind === "new" || panel?.kind === "edit" ? (
          <BillSheet
            key={panel.kind === "edit" ? panel.bill.id : "new"}
            bill={panel.kind === "edit" ? panel.bill : undefined}
            people={people}
            initialOwner={choiceFromScope(props.scope, people)}
            payAccounts={props.payAccounts}
            cardAccounts={props.cardAccounts}
            categories={props.categories}
            today={props.today}
            onDone={close}
          />
        ) : null}
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && close()}>
        {panel?.kind === "pay" ? <PayDialog bill={panel.bill} accounts={props.payAccounts} today={props.today} onDone={close} /> : null}
        {panel?.kind === "delete" ? (
          <DialogContent
            title={`Hapus tagihan ${panel.bill.name}?`}
            description="Transaksi pembayaran sebelumnya tetap tersimpan."
            footer={
              <>
                <Button onClick={close}>Batal</Button>
                <Button
                  variant="danger"
                  loading={remove.pending}
                  onClick={() =>
                    remove.run(
                      () => deleteBillAction({ id: panel.bill.id, version: panel.bill.version }),
                      () => {
                        toast.show({ title: "Terhapus" });
                        close();
                      },
                    )
                  }
                >
                  Hapus tagihan
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
