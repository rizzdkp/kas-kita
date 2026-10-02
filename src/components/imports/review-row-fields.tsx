"use client";

import { memo } from "react";
import { Check } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import { formatShortDate, parseDateKey } from "@/lib/dates";
import { GroupedSelect, type OptionGroup } from "@/components/transactions/grouped-select";
import { categoryOptions } from "@/components/transactions/option-groups";
import type { BeneficiaryChoice } from "@/components/transactions/labels";
import type { CategoryGroup, People } from "@/components/transactions/types";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/cn";
import type { ReviewRow } from "@/server/queries/import-review";

export function rowDateLabel(row: Pick<ReviewRow, "date" | "time">): string {
  const d = parseDateKey(row.date);
  const day = d ? formatShortDate(d) : row.date;
  return row.time ? `${day}, ${row.time.replace(":", ".")}` : day;
}

/** Teks untuk label pembaca layar: deskripsi, tanggal, nominal bertanda. */
export function rowSpokenLabel(row: ReviewRow): string {
  const sign = row.amount < 0n ? "keluar" : "masuk";
  const abs = row.amount < 0n ? -row.amount : row.amount;
  return `${row.description}, ${rowDateLabel(row)}, ${sign} ${formatRupiah(abs)}`;
}

export function whoOptions(people: People): Array<{ value: BeneficiaryChoice; label: string }> {
  return [
    { value: "me", label: "Kamu" },
    ...(people.partner ? [{ value: "partner" as const, label: people.partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ];
}

export interface CategoryOptionGroups {
  expense: OptionGroup[];
  income: OptionGroup[];
}

/** Opsi kategori dibuat sekali per layar, bukan per baris. */
export function buildCategoryOptionGroups(categories: { expense: CategoryGroup[]; income: CategoryGroup[] }): CategoryOptionGroups {
  return { expense: [{ options: categoryOptions(categories.expense) }], income: [{ options: categoryOptions(categories.income) }] };
}

type FieldsProps = {
  row: ReviewRow;
  categoryGroups: CategoryOptionGroups;
  people: People;
  /** Akun Bersama tidak punya pilihan untuk siapa. */
  sharedAccount: boolean;
  categoryId: string | null;
  who: BeneficiaryChoice;
  invalid: boolean;
  onCategory: (rowId: string, categoryId: string) => void;
  onWho: (rowId: string, who: BeneficiaryChoice) => void;
  className?: string;
};

/** Kategori dan untuk siapa per baris; dipakai baris Baru dan "Beda, impor sebagai baru". */
export const ReviewRowFields = memo(function ReviewRowFields({
  row,
  categoryGroups,
  people,
  sharedAccount,
  categoryId,
  who,
  invalid,
  onCategory,
  onWho,
  className,
}: FieldsProps) {
  const groups = row.amount > 0n ? categoryGroups.income : categoryGroups.expense;
  return (
    <div className={cn("grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_140px]", className)}>
      <Field label={`Kategori untuk ${row.description}`} hideLabel error={invalid ? "Pilih kategori" : null} className="min-w-0 gap-1">
        <GroupedSelect
          value={categoryId ?? ""}
          onValueChange={(v) => onCategory(row.id, v)}
          groups={groups}
          placeholder="Pilih kategori"
          className="w-full"
        />
      </Field>
      {sharedAccount ? null : (
        <Select
          value={who}
          onValueChange={(v) => onWho(row.id, v as BeneficiaryChoice)}
          options={whoOptions(people)}
          aria-label={`Untuk siapa: ${row.description}`}
          className="w-full"
        />
      )}
    </div>
  );
});

type RowCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

/** Checkbox 44px tanpa label terlihat; baris sudah menampilkan teksnya, label lengkap untuk pembaca layar. */
export function RowCheckbox({ checked, onChange, label }: RowCheckboxProps) {
  return (
    <label className="group flex size-11 cursor-pointer items-center justify-center sm:size-10">
      <span className="relative inline-flex size-5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface",
            "transition-colors duration-(--dur-fast) ease-(--ease-out)",
            "checked:border-accent checked:bg-accent group-hover:border-accent",
          )}
        />
        <Icon icon={Check} size={16} className="pointer-events-none absolute left-0.5 top-0.5 text-on-accent opacity-0 peer-checked:opacity-100" />
      </span>
    </label>
  );
}
