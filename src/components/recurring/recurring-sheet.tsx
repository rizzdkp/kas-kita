"use client";

import { useMemo, useState, useTransition } from "react";
import { AmountInput } from "@/components/money/amount-input";
import { GroupedSelect } from "@/components/transactions/grouped-select";
import { KIND_OPTIONS, type BeneficiaryChoice } from "@/components/transactions/labels";
import { accountOptionGroups, categoryOptions } from "@/components/transactions/option-groups";
import { categoryExists } from "@/components/transactions/form-values";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { Scope } from "@/lib/scope";
import { createRecurringRuleAction, updateRecurringRuleAction } from "@/server/actions/recurring";
import { buildRecurrenceRule, describeRecurrence, isDateKey, shortMonthNote } from "@/server/recurring/schedule";
import { FREQUENCY_OPTIONS, initialRecurringValues, toRecurringSubmit, type RecurringFormValues, type RecurringInitial } from "./form-model";

type RecurringSheetProps = {
  /** Ada id dan versi berarti mengubah jadwal. */
  editing?: { id: string; version: number; label: string };
  initial?: RecurringInitial;
  options: TransactionFormOptions;
  scope: Scope;
  today: string;
  onDone: () => void;
};

const FIELD_KEYS: Record<string, string> = { tagNames: "tags" };

function serverFieldErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    const parts = key.split(".");
    const field = (parts[0] === "fields" ? parts[1] : parts[0]) ?? "_";
    const target = FIELD_KEYS[field] ?? field;
    if (messages[0] && !out[target]) out[target] = messages[0];
  }
  return out;
}

/** Form jadwal transaksi berulang (F-IN-7) dalam Sheet; field mengikuti form transaksi tanpa jam. */
export function RecurringSheet({ editing, initial, options, scope, today, onDone }: RecurringSheetProps) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const start = useMemo(() => initialRecurringValues(options, scope, today, initial), [options, scope, today, initial]);
  const [values, setValues] = useState<RecurringFormValues>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { people } = options;
  const account = options.accounts.find((a) => a.id === values.accountId);
  const groups = accountOptionGroups(options.accounts, people, [initial?.accountId, initial?.toAccountId]);
  const transfer = values.kind === "transfer";

  const onChange = (patch: Partial<RecurringFormValues>) => {
    setValues((v) => {
      const next = { ...v, ...patch };
      if (patch.kind && !categoryExists(options, patch.kind, next.categoryId)) next.categoryId = "";
      return next;
    });
    setErrors((e) => {
      const keys = Object.keys(patch).map((k) => (k === "amountText" ? "amount" : k === "tagsText" ? "tags" : k));
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  };

  const rule = isDateKey(values.nextRunOn) ? buildRecurrenceRule(values.frequency, values.nextRunOn, values.interval) : null;
  const ruleHint = rule ? [describeRecurrence(rule, values.nextRunOn), shortMonthNote(rule)].filter(Boolean).join(". ") : undefined;

  const submit = () => {
    const { fields, errors: clientErrors } = toRecurringSubmit(values, options, today, initial?.nextRunOn);
    if (!fields) {
      setErrors(clientErrors);
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateRecurringRuleAction({ id: editing.id, version: editing.version, fields })
        : await createRecurringRuleAction(fields);
      if (result.ok) {
        const partnerName = people.partner?.name;
        const partnerData = partnerName && account?.ownerId === people.partner?.id;
        toast.show({ title: "Tersimpan", description: editing && partnerData ? `${partnerName} akan melihat perubahan ini di riwayat.` : undefined });
        onDone();
        return;
      }
      if (result.code === "conflict") {
        setFormError("Jadwal ini baru diubah di perangkat lain. Tutup lalu buka lagi untuk melihat versi terbaru.");
        return;
      }
      const mapped = serverFieldErrors(result.fieldErrors);
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      else setFormError(result.error);
    });
  };

  const beneficiaryOptions: Array<{ value: BeneficiaryChoice; label: string }> = [
    { value: "me", label: "Kamu" },
    ...(people.partner ? [{ value: "partner" as const, label: people.partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ];

  return (
    <SheetContent title={editing ? `Ubah ${editing.label}` : "Tambah transaksi berulang"}>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) submit();
        }}
      >
        <SegmentedControl label="Jenis transaksi" value={values.kind} options={KIND_OPTIONS} onValueChange={(kind) => onChange({ kind })} className="w-full" />

        <Field label="Nama atau catatan" error={errors.note} description="Tampil di daftar jadwal dan di transaksi yang dibuat.">
          <Input value={values.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Misalnya sewa kos" maxLength={500} />
        </Field>

        <Field label="Nominal" error={errors.amount} required>
          <AmountInput value={values.amountText} onValueChange={(amountText) => onChange({ amountText })} placeholder="Misalnya 25rb" />
        </Field>

        <Field label={transfer ? "Dari akun" : "Akun"} error={errors.accountId} required>
          <GroupedSelect value={values.accountId} onValueChange={(accountId) => onChange({ accountId })} groups={groups} placeholder="Pilih akun" />
        </Field>

        {transfer ? (
          <Field label="Ke akun" error={errors.toAccountId} required>
            <GroupedSelect value={values.toAccountId} onValueChange={(toAccountId) => onChange({ toAccountId })} groups={groups} placeholder="Pilih akun tujuan" />
          </Field>
        ) : (
          <Field label="Kategori" error={errors.categoryId} required>
            <GroupedSelect
              value={values.categoryId}
              onValueChange={(categoryId) => onChange({ categoryId })}
              groups={[{ options: categoryOptions(options.categories[values.kind === "income" ? "income" : "expense"]) }]}
              placeholder="Pilih kategori"
            />
          </Field>
        )}

        {values.kind === "expense" && account && account.ownerId !== null ? (
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-small font-medium text-primary">
              Untuk siapa
            </span>
            <SegmentedControl label="Untuk siapa" value={values.beneficiary} options={beneficiaryOptions} onValueChange={(beneficiary) => onChange({ beneficiary })} className="w-full" />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-small font-medium text-primary">
            Pengulangan
          </span>
          <SegmentedControl label="Pengulangan" value={values.frequency} options={FREQUENCY_OPTIONS} onValueChange={(frequency) => onChange({ frequency })} className="w-full" />
        </div>

        <Field label="Berikutnya pada" error={errors.nextRunOn} description={ruleHint} required>
          <Input type="date" value={values.nextRunOn} min={today} onChange={(e) => onChange({ nextRunOn: e.target.value })} />
        </Field>

        <Switch
          checked={values.autoConfirm}
          onCheckedChange={(autoConfirm) => onChange({ autoConfirm })}
          label="Konfirmasi otomatis"
          description={
            values.autoConfirm
              ? "Transaksi langsung tercatat pada tanggalnya tanpa menunggu konfirmasi."
              : "Transaksi masuk ke Perlu dikonfirmasi pada tanggalnya, lalu kamu yang mengonfirmasi."
          }
        />

        <Field label="Tag" error={errors.tags} description="Pisahkan dengan koma, misalnya kantor, liburan">
          <Input value={values.tagsText} onChange={(e) => onChange({ tagsText: e.target.value })} autoComplete="off" />
        </Field>

        {formError ? (
          <p role="alert" className="text-small text-error">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button onClick={onDone} disabled={pending}>
            Batal
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Simpan
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
