"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TransactionQuery } from "./filter-params";
import { GroupedSelect } from "./grouped-select";
import { KIND_OPTIONS } from "./labels";
import { accountOptionGroups, categoryOptions } from "./option-groups";
import type { CategoryGroup, FormAccount, People } from "./types";

// Radix Select tidak menerima nilai kosong, jadi "semua" memakai penanda ini
export const ALL = "__semua";

export interface FilterOptions {
  accounts: FormAccount[];
  categories: { expense: CategoryGroup[]; income: CategoryGroup[] };
  tags: Array<{ id: string; name: string }>;
  people: People;
}

export type FilterKey = "kind" | "accountId" | "categoryId" | "createdBy" | "tag" | "from" | "to";

type ControlProps = {
  query: TransactionQuery;
  onChange: (patch: Partial<TransactionQuery>) => void;
  options: FilterOptions;
  /** Label hanya untuk pembaca layar (bar desktop). */
  compact?: boolean;
  className?: string;
};

export function KindFilter({ query, onChange, compact, className }: ControlProps) {
  return (
    <Field label="Jenis" hideLabel={compact} className={className}>
      <Select
        value={query.kind ?? ALL}
        onValueChange={(v) => onChange({ kind: v === ALL ? null : (v as TransactionQuery["kind"]) })}
        options={[{ value: ALL, label: "Semua jenis" }, ...KIND_OPTIONS]}
      />
    </Field>
  );
}

export function AccountFilter({ query, onChange, options, compact, className }: ControlProps) {
  const groups = accountOptionGroups(options.accounts, options.people, [query.accountId]);
  return (
    <Field label="Akun" hideLabel={compact} className={className}>
      <GroupedSelect
        value={query.accountId ?? ALL}
        onValueChange={(v) => onChange({ accountId: v === ALL ? null : v })}
        groups={[{ options: [{ value: ALL, label: "Semua akun" }] }, ...groups]}
      />
    </Field>
  );
}

export function CategoryFilter({ query, onChange, options, compact, className }: ControlProps) {
  return (
    <Field label="Kategori" hideLabel={compact} className={className}>
      <GroupedSelect
        value={query.categoryId ?? ALL}
        onValueChange={(v) => onChange({ categoryId: v === ALL ? null : v })}
        groups={[
          { options: [{ value: ALL, label: "Semua kategori" }] },
          { label: "Pengeluaran", options: categoryOptions(options.categories.expense) },
          { label: "Pemasukan", options: categoryOptions(options.categories.income) },
        ]}
      />
    </Field>
  );
}

export function RecorderFilter({ query, onChange, options, compact, className }: ControlProps) {
  const { me, partner } = options.people;
  return (
    <Field label="Diisi oleh" hideLabel={compact} className={className}>
      <Select
        value={query.createdBy ?? ALL}
        onValueChange={(v) => onChange({ createdBy: v === ALL ? null : v })}
        options={[
          { value: ALL, label: "Siapa saja" },
          { value: me.id, label: me.name },
          ...(partner ? [{ value: partner.id, label: partner.name }] : []),
        ]}
      />
    </Field>
  );
}

export function TagFilter({ query, onChange, options, compact, className }: ControlProps) {
  const selected = options.tags.find((t) => t.id === query.tag || t.name === query.tag);
  return (
    <Field label="Tag" hideLabel={compact} className={className}>
      <Select
        value={selected?.id ?? ALL}
        onValueChange={(v) => onChange({ tag: v === ALL ? null : v })}
        options={[{ value: ALL, label: options.tags.length ? "Semua tag" : "Belum ada tag" }, ...options.tags.map((t) => ({ value: t.id, label: t.name }))]}
      />
    </Field>
  );
}

export function DateRangeFilter({ query, onChange, className }: ControlProps) {
  return (
    <div className={className ?? "grid grid-cols-2 gap-3"}>
      <Field label="Dari tanggal">
        <Input type="date" value={query.from ?? ""} max={query.to ?? undefined} onChange={(e) => onChange({ from: e.target.value || null })} />
      </Field>
      <Field label="Sampai tanggal">
        <Input type="date" value={query.to ?? ""} min={query.from ?? undefined} onChange={(e) => onChange({ to: e.target.value || null })} />
      </Field>
    </div>
  );
}
