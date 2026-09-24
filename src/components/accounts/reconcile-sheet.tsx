"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { parseAmount } from "@/lib/money";
import { Amount } from "@/components/money/amount";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { reconcileAccountAction, reconcilePreviewAction, type ReconcilePreview } from "@/server/actions/accounts";
import type { AccountWithBalance } from "@/server/queries/accounts";
import { isLiabilityType, relativeDayInline } from "./labels";

type ReconcileSheetProps = {
  account: AccountWithBalance | null;
  onOpenChange: (open: boolean) => void;
};

// selisih di atas 1% saldo tercatat diberi warna perhatian (DESIGN 2.1)
export function isLargeDifference(recorded: bigint, difference: bigint): boolean {
  const abs = (v: bigint) => (v < 0n ? -v : v);
  if (difference === 0n) return false;
  if (recorded === 0n) return true;
  return abs(difference) * 100n > abs(recorded);
}

export function ReconcileSheet({ account, onOpenChange }: ReconcileSheetProps) {
  return (
    <Sheet open={account !== null} onOpenChange={onOpenChange}>
      {account ? (
        <SheetContent
          title={`Cocokkan saldo ${account.name}`}
          description={
            account.lastReconciledAt
              ? `Terakhir dicocokkan ${relativeDayInline(account.lastReconciledAt)}.`
              : "Belum pernah dicocokkan."
          }
        >
          <ReconcileForm key={account.id} account={account} onDone={() => onOpenChange(false)} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function ReconcileForm({ account, onDone }: { account: AccountWithBalance; onDone: () => void }) {
  const toast = useToast();
  const liability = isLiabilityType(account.type);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ReconcilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const typed = parseAmount(text);
  // utang diketik positif seperti di aplikasi bank, disimpan negatif
  const actual = typed === null ? null : liability ? -(typed < 0n ? -typed : typed) : typed;

  useEffect(() => {
    if (actual === null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await reconcilePreviewAction({ accountId: account.id, actualBalance: actual });
      if (cancelled) return;
      if (result.ok) {
        setPreview(result.data);
        setError(null);
      } else setError(result.error);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [account.id, actual]);

  const shown = preview && actual !== null && preview.actual === actual ? preview : null;
  const large = shown ? isLargeDifference(shown.recorded, shown.difference) : false;
  const sign = liability ? -1n : 1n;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (actual === null) {
      setError("Isi saldo sebenarnya, misalnya 2,5jt");
      return;
    }
    startTransition(async () => {
      const result = await reconcileAccountAction({ accountId: account.id, version: account.version, actualBalance: actual });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show({ title: result.data.adjustmentId ? "Penyesuaian dibuat" : "Saldo sudah cocok" });
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Field
        label={liability ? "Sisa tagihan di aplikasi bank" : "Saldo di aplikasi bank"}
        description={liability ? "Isi sebagai angka positif." : undefined}
        error={error}
      >
        <AmountInput value={text} onValueChange={(t) => setText(t)} placeholder="0" autoFocus />
      </Field>

      <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-body">
        <dt className="text-secondary">Tercatat di Kas Kita</dt>
        <dd className="text-right">
          <Amount value={(shown?.recorded ?? account.balance) * sign} />
        </dd>
        <dt className="text-secondary">Sebenarnya</dt>
        <dd className="text-right">{shown ? <Amount value={shown.actual * sign} /> : <span className="text-secondary">belum diisi</span>}</dd>
        <dt className="border-t border-border pt-2 pr-4 font-medium text-primary">Selisih</dt>
        <dd className="border-t border-border pt-2 text-right font-medium">
          {shown ? <Amount value={shown.difference * sign} sign="always" tone={large ? "attention" : "default"} /> : <span className="text-secondary">belum diisi</span>}
        </dd>
      </dl>

      {shown && large ? (
        <p className="flex gap-2 text-small text-attention">
          <Icon icon={CircleAlert} size={16} className="mt-0.5 shrink-0" />
          <span>Selisihnya lebih dari 1% saldo. Cek dulu transaksi yang mungkin belum dicatat sebelum membuat penyesuaian.</span>
        </p>
      ) : null}
      {shown ? (
        <p className="text-small text-secondary">
          {shown.difference === 0n
            ? "Saldo sudah sama. Menyimpan hanya mencatat tanggal pencocokan."
            : "Penyesuaian dicatat dengan kategori Penyesuaian saldo dan tidak masuk pemasukan, pengeluaran, atau rasio tabungan."}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={actual === null}>
          {shown?.difference === 0n ? "Tandai sudah cocok" : "Buat penyesuaian"}
        </Button>
      </div>
    </form>
  );
}
