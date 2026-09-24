"use client";

import { AmountInput } from "@/components/money/amount-input";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { FormValues } from "./form-values";
import { GroupedSelect } from "./grouped-select";
import { KIND_OPTIONS, type BeneficiaryChoice } from "./labels";
import { accountOptionGroups, categoryOptions } from "./option-groups";
import type { TransactionFormOptions } from "./types";

type FieldsProps = {
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  errors: Record<string, string>;
  options: TransactionFormOptions;
  mode: "create" | "edit";
  /** Akun yang harus tetap tampil walau diarsipkan (mode edit). */
  keepAccountIds: Array<string | null | undefined>;
};

export function TransactionFormFields({ values, onChange, errors, options, mode, keepAccountIds }: FieldsProps) {
  const { people } = options;
  const account = options.accounts.find((a) => a.id === values.accountId);
  const accountGroups = accountOptionGroups(options.accounts, people, keepAccountIds);
  const transfer = values.kind === "transfer";
  const partner = people.partner;
  const forPartner = mode === "create" && partner !== null && account?.ownerId === partner.id;

  const beneficiaryOptions: Array<{ value: BeneficiaryChoice; label: string }> = [
    { value: "me", label: "Saya" },
    ...(partner ? [{ value: "partner" as const, label: partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {forPartner && partner ? (
        <p className="flex items-center gap-2 text-small text-secondary">
          <IdentityDot color={partner.color} />
          Dicatat atas nama {partner.name}, diisi oleh kamu
        </p>
      ) : null}

      <SegmentedControl
        label="Jenis transaksi"
        value={values.kind}
        options={KIND_OPTIONS}
        onValueChange={(kind) => onChange({ kind })}
        className="w-full"
      />

      <Field label="Nominal" error={errors.amount} required>
        <AmountInput
          value={values.amountText}
          onValueChange={(amountText) => onChange({ amountText })}
          placeholder="Misalnya 25rb"
          autoFocus={mode === "create"}
        />
      </Field>

      <Field label={transfer ? "Dari akun" : "Akun"} error={errors.accountId} required>
        <GroupedSelect value={values.accountId} onValueChange={(accountId) => onChange({ accountId })} groups={accountGroups} placeholder="Pilih akun" />
      </Field>

      {transfer ? (
        <Field label="Ke akun" error={errors.toAccountId} required>
          <GroupedSelect
            value={values.toAccountId}
            onValueChange={(toAccountId) => onChange({ toAccountId })}
            groups={accountGroups}
            placeholder="Pilih akun tujuan"
          />
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

      <Field label="Tanggal dan waktu" error={errors.occurredAt} required>
        <Input type="datetime-local" value={values.occurredLocal} onChange={(e) => onChange({ occurredLocal: e.target.value })} />
      </Field>

      {values.kind === "expense" && account && account.ownerId !== null ? (
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-small font-medium text-primary">
            Untuk siapa
          </span>
          <SegmentedControl
            label="Untuk siapa"
            value={values.beneficiary}
            options={beneficiaryOptions}
            onValueChange={(beneficiary) => onChange({ beneficiary })}
            className="w-full"
          />
        </div>
      ) : null}

      <Field label="Catatan" error={errors.note}>
        <Input value={values.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Misalnya belanja mingguan" maxLength={500} />
      </Field>

      <Field label="Tag" error={errors.tags} description="Pisahkan dengan koma, misalnya kantor, liburan">
        <Input value={values.tagsText} onChange={(e) => onChange({ tagsText: e.target.value })} autoComplete="off" />
      </Field>
    </div>
  );
}
