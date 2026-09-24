"use client";

import type { AccountType } from "@/server/db/schema";
import type { People } from "@/components/transactions/types";
import { AmountInput } from "@/components/money/amount-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AccountFormState, FormErrors, OwnerChoice } from "./account-form-model";
import { NO_INSTITUTION } from "./account-form-model";
import { ACCOUNT_TYPE_OPTIONS, canOverdraft, hasCreditTerms, isLiabilityType } from "./labels";

export type InstitutionOption = { id: string; name: string };

type Props = {
  state: AccountFormState;
  errors: FormErrors;
  people: People;
  institutions: InstitutionOption[];
  onChange: (patch: Partial<AccountFormState>) => void;
};

function openingCopy(type: AccountType): { label: string; description: string } {
  if (isLiabilityType(type)) {
    return {
      label: "Utang awal",
      description: "Isi sisa utang sebagai angka positif, misalnya 2,5jt. Kas Kita menyimpannya sebagai saldo negatif.",
    };
  }
  if (type === "investment") return { label: "Modal awal", description: "Uang yang sudah ditanam sebelum dicatat di sini." };
  return { label: "Saldo awal", description: "Saldo di aplikasi bank pada tanggal saldo awal." };
}

export function AccountFormFields({ state, errors, people, institutions, onChange }: Props) {
  const ownerOptions: Array<{ value: OwnerChoice; label: string }> = [
    { value: "me", label: "Saya" },
    ...(people.partner ? [{ value: "partner" as const, label: people.partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ];
  const opening = openingCopy(state.type);
  const credit = hasCreditTerms(state.type);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nama akun" error={errors.name} required>
        <Input value={state.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="BCA harian" autoComplete="off" maxLength={60} />
      </Field>

      <Field label="Jenis" error={errors.type}>
        <Select value={state.type} onValueChange={(v) => onChange({ type: v as AccountType })} options={ACCOUNT_TYPE_OPTIONS} />
      </Field>

      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-small font-medium text-primary">
          Pemilik
        </span>
        <SegmentedControl
          label="Pemilik"
          value={state.owner}
          onValueChange={(owner) => onChange({ owner })}
          options={ownerOptions}
          className="w-full"
        />
        {errors.owner ? <p className="text-small text-error">{errors.owner}</p> : null}
      </div>

      <Field label="Institusi">
        <Select
          value={state.institutionId}
          onValueChange={(institutionId) => onChange({ institutionId })}
          options={[{ value: NO_INSTITUTION, label: "Tanpa institusi" }, ...institutions.map((i) => ({ value: i.id, label: i.name }))]}
        />
      </Field>

      <Field label={opening.label} error={errors.openingText} description={opening.description}>
        <AmountInput value={state.openingText} onValueChange={(openingText) => onChange({ openingText })} placeholder="0" />
      </Field>
      <Field label="Tanggal saldo awal" error={errors.openingDate}>
        <Input type="date" value={state.openingDate} onChange={(e) => onChange({ openingDate: e.target.value })} />
      </Field>

      {canOverdraft(state.type) ? (
        <Switch
          checked={state.allowNegative}
          onCheckedChange={(allowNegative) => onChange({ allowNegative })}
          label="Izinkan saldo negatif"
          description="Untuk rekening dengan fasilitas cerukan. Tanpa ini, transaksi yang membuat saldo minus ditolak."
        />
      ) : null}
      {state.type === "cash" ? <p className="text-small text-secondary">Saldo Tunai tidak pernah boleh negatif.</p> : null}

      {credit ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Limit" error={errors.limitText} className="col-span-2">
            <AmountInput value={state.limitText} onValueChange={(limitText) => onChange({ limitText })} placeholder="misalnya 10jt" />
          </Field>
          <Field label="Tanggal cetak tagihan" error={errors.statementDay}>
            <Input
              inputMode="numeric"
              value={state.statementDay}
              onChange={(e) => onChange({ statementDay: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              placeholder="1 sampai 31"
            />
          </Field>
          <Field label="Tanggal jatuh tempo" error={errors.dueDay}>
            <Input
              inputMode="numeric"
              value={state.dueDay}
              onChange={(e) => onChange({ dueDay: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              placeholder="1 sampai 31"
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
