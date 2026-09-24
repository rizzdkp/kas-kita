"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { percentOf } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { Amount } from "@/components/money/amount";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { People } from "@/components/transactions/types";
import { deleteValuationAction } from "@/server/actions/investments";
import type { InvestmentSummary, ValuationRow } from "@/server/queries/investments";
import { dayText, InvestmentCard, signedPercent } from "./investment-card";
import { ValuationSheet, type ValuationTarget } from "./valuation-sheet";

type Props = {
  items: InvestmentSummary[];
  people: People;
  scope: Scope;
  today: string;
};

function Totals({ items }: { items: InvestmentSummary[] }) {
  const valued = items.filter((i) => i.marketValue !== null);
  const value = valued.reduce((s, i) => s + (i.marketValue ?? 0n), 0n);
  const capital = valued.reduce((s, i) => s + i.contributed, 0n);
  const gain = value - capital;
  const pct = capital > 0n ? percentOf(gain, capital) : null;
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 px-1 text-body">
      <div className="flex gap-2">
        <dt className="text-secondary">Total nilai pasar</dt>
        <dd className="font-medium text-primary">
          <Amount value={value} />
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-secondary">Total imbal hasil</dt>
        <dd className="font-medium text-primary">
          <Amount value={gain} sign="always" />
          {pct !== null ? <span className="tabular text-secondary"> ({signedPercent(pct)})</span> : null}
        </dd>
      </div>
    </dl>
  );
}

export function InvestmentsView({ items, people, scope, today }: Props) {
  const toast = useToast();
  const [target, setTarget] = useState<ValuationTarget | null>(null);
  const [toDelete, setToDelete] = useState<{ valuation: ValuationRow; accountName: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    const whose = scope === "partner" && people.partner ? `${people.partner.name} belum punya` : "Belum ada";
    return (
      <Card>
        <EmptyState
          title={`${whose} akun Investasi`}
          action={
            <Link href={`/akun?baru=1&jenis=investment&scope=${scope}`} className={buttonClassName("primary")}>
              Tambah akun Investasi
            </Link>
          }
        >
          Buat akun jenis Investasi untuk reksa dana, saham, atau emas. Nilai pasarnya kamu perbarui sendiri di sini, lalu imbal hasil dihitung dari modal yang disetor.
        </EmptyState>
      </Card>
    );
  }

  function confirmDelete() {
    if (!toDelete) return;
    const { valuation } = toDelete;
    startTransition(async () => {
      const result = await deleteValuationAction({ id: valuation.id, version: valuation.version });
      if (result.ok) {
        toast.show({ title: "Nilai dihapus" });
        setToDelete(null);
      } else setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-32">
      {items.length > 1 ? <Totals items={items} /> : null}
      {items.map((item) => (
        <InvestmentCard
          key={item.account.id}
          item={item}
          people={people}
          onUpdate={() => setTarget({ accountId: item.account.id, accountName: item.account.name, valuation: null })}
          onEdit={(valuation) => setTarget({ accountId: item.account.id, accountName: item.account.name, valuation })}
          onDelete={(valuation) => {
            setDeleteError(null);
            setToDelete({ valuation, accountName: item.account.name });
          }}
        />
      ))}

      <ValuationSheet target={target} today={today} onOpenChange={(o) => (o ? null : setTarget(null))} />
      <Dialog open={toDelete !== null} onOpenChange={(o) => (o ? null : setToDelete(null))}>
        {toDelete ? (
          <DialogContent
            title={`Hapus nilai ${dayText(toDelete.valuation.valuedOn)}?`}
            description={`Titik ini hilang dari grafik ${toDelete.accountName}. Kalau ini nilai terbaru, imbal hasil dihitung dari nilai sebelumnya.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setToDelete(null)}>
                  Batal
                </Button>
                <Button variant="danger" loading={pending} onClick={confirmDelete}>
                  Hapus nilai
                </Button>
              </>
            }
          >
            {deleteError ? (
              <p role="alert" className="text-small text-error">
                {deleteError}
              </p>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
