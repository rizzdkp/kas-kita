"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatAmountInput, parseAmount } from "@/lib/money";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { createValuationAction, updateValuationAction } from "@/server/actions/investments";
import type { ValuationRow } from "@/server/queries/investments";

export type ValuationTarget = { accountId: string; accountName: string; valuation: ValuationRow | null };

type Props = {
  target: ValuationTarget | null;
  today: string;
  onOpenChange: (open: boolean) => void;
};

export function ValuationSheet({ target, today, onOpenChange }: Props) {
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      {target ? (
        <SheetContent
          title={target.valuation ? "Ubah nilai pasar" : "Perbarui nilai"}
          description={`${target.accountName}. Isi nilai pasar dari aplikasi investasimu pada tanggal itu.`}
        >
          <ValuationForm key={target.valuation?.id ?? target.accountId} target={target} today={today} onDone={() => onOpenChange(false)} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

type Errors = { valuedOn?: string; marketValue?: string; note?: string; form?: string };

function versionOf(latest: unknown): number | null {
  if (latest && typeof latest === "object" && "version" in latest && typeof latest.version === "number") return latest.version;
  return null;
}

function ValuationForm({ target, today, onDone }: { target: ValuationTarget; today: string; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const existing = target.valuation;
  const [valuedOn, setValuedOn] = useState(existing?.valuedOn ?? today);
  const [valueText, setValueText] = useState(existing ? formatAmountInput(existing.marketValue.toString()) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function save(version?: number) {
    const marketValue = parseAmount(valueText);
    const next: Errors = {};
    if (marketValue === null || marketValue < 0n) next.marketValue = "Isi nilai pasar, misalnya 14,5jt";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valuedOn)) next.valuedOn = "Pilih tanggal";
    else if (valuedOn > today) next.valuedOn = "Tanggal nilai tidak boleh setelah hari ini";
    setErrors(next);
    if (marketValue === null || Object.keys(next).length > 0) return;

    const fields = { valuedOn, marketValue, note: note.trim() || null };
    setConflictVersion(null);
    startTransition(async () => {
      const result = existing
        ? await updateValuationAction({ id: existing.id, version: version ?? existing.version, patch: fields })
        : await createValuationAction({ ...fields, accountId: target.accountId });
      if (result.ok) {
        toast.show({ title: "Tersimpan" });
        onDone();
        return;
      }
      const latest = result.conflict ? versionOf(result.conflict.latest) : null;
      if (latest !== null) setConflictVersion(latest);
      const fe = result.fieldErrors ?? {};
      const pick = (k: string) => fe[k]?.[0] ?? fe[`patch.${k}`]?.[0];
      const mapped: Errors = { valuedOn: pick("valuedOn"), marketValue: pick("marketValue"), note: pick("note") };
      setErrors(mapped.valuedOn || mapped.marketValue || mapped.note ? mapped : { form: result.error });
    });
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label="Tanggal" error={errors.valuedOn}>
          <Input type="date" value={valuedOn} max={today} onChange={(e) => setValuedOn(e.target.value)} />
        </Field>
        <Field label="Nilai pasar" error={errors.marketValue}>
          <AmountInput value={valueText} onValueChange={(t) => setValueText(t)} placeholder="0" autoFocus={!existing} />
        </Field>
        <Field label="Catatan" description="Opsional, misalnya sumber angkanya." error={errors.note}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} autoComplete="off" />
        </Field>
      </div>

      {errors.form ? (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-border bg-surface-sunken p-4">
          <p className="text-small text-primary">{errors.form}</p>
          {conflictVersion !== null ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save(conflictVersion)}>Pakai versi saya</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onDone();
                  router.refresh();
                }}
              >
                Pakai versi terbaru
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
