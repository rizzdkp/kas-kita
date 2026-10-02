"use client";

import { ChevronRight } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, type SelectOption } from "@/components/ui/select";
import type { CsvLayout } from "@/server/import/csv/preview";
import type { CsvMapping } from "@/server/import/types";
import {
  AMOUNT_MODE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DECIMAL_OPTIONS,
  DELIMITER_OPTIONS,
  DIRECTION_OPTIONS,
  ENCODING_OPTIONS,
  headerRowLabel,
  NONE,
  type AmountMode,
} from "./mapping-labels";

type MappingFieldsProps = {
  mapping: CsvMapping;
  columns: string[];
  topRows: string[][];
  amountMode: AmountMode;
  disabled: boolean;
  onMapping: (patch: Partial<CsvMapping>) => void;
  onAmountMode: (mode: AmountMode) => void;
  onLayout: (patch: Partial<CsvLayout>) => void;
};

function columnOptions(columns: string[], optional: boolean): SelectOption[] {
  const list = columns.map((c) => ({ value: c, label: c }));
  return optional ? [{ value: NONE, label: "Tidak dipakai" }, ...list] : list;
}

// Radix Select tidak menerima value kosong; kolom yang belum dipilih memakai placeholder
function selected(value: string | null, optional: boolean): string | undefined {
  if (value) return value;
  return optional ? NONE : undefined;
}

function picked(value: string): string | null {
  return value === NONE ? null : value;
}

/** Form pemetaan F-IN-4 AC1 dan AC3: kolom, format tanggal, arah nominal, pemisah desimal. */
export function MappingFields({ mapping, columns, topRows, amountMode, disabled, onMapping, onAmountMode, onLayout }: MappingFieldsProps) {
  const required = columnOptions(columns, false);
  const optional = columnOptions(columns, true);
  const headerOptions: SelectOption[] = [
    ...topRows.map((cells, i) => ({ value: String(i), label: headerRowLabel(i, cells) })),
    { value: "-1", label: "Tanpa baris header" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Field label="Baris header" description="Baris berisi nama kolom. Baris di atasnya dilewati.">
        <Select value={String(mapping.headerRow)} options={headerOptions} onValueChange={(v) => onLayout({ headerRow: Number(v) })} disabled={disabled} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="Kolom tanggal">
          <Select value={selected(mapping.dateColumn, false)} placeholder="Pilih kolom" options={required} onValueChange={(v) => onMapping({ dateColumn: v })} disabled={disabled} />
        </Field>
        <Field label="Format tanggal" description="Terdeteksi dari isi kolom. Ubah kalau tanggalnya terbaca salah.">
          <Select
            value={mapping.dateFormat}
            options={DATE_FORMAT_OPTIONS}
            onValueChange={(v) => onMapping({ dateFormat: v as CsvMapping["dateFormat"] })}
            disabled={disabled}
          />
        </Field>
      </div>

      <Field label="Kolom deskripsi">
        <Select value={selected(mapping.descriptionColumn, false)} placeholder="Pilih kolom" options={required} onValueChange={(v) => onMapping({ descriptionColumn: v })} disabled={disabled} />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-small font-medium text-primary">Nominal</legend>
        <SegmentedControl label="Bentuk kolom nominal" value={amountMode} options={AMOUNT_MODE_OPTIONS} onValueChange={onAmountMode} className="w-full" />
        {amountMode === "split" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label="Kolom debit (keluar)">
              <Select value={selected(mapping.debitColumn, true)} options={optional} onValueChange={(v) => onMapping({ debitColumn: picked(v) })} disabled={disabled} />
            </Field>
            <Field label="Kolom kredit (masuk)">
              <Select value={selected(mapping.creditColumn, true)} options={optional} onValueChange={(v) => onMapping({ creditColumn: picked(v) })} disabled={disabled} />
            </Field>
          </div>
        ) : (
          <>
            <Field label="Kolom nominal" description="Akhiran CR dan DB dibaca otomatis sebagai masuk dan keluar.">
              <Select value={selected(mapping.amountColumn, false)} placeholder="Pilih kolom" options={required} onValueChange={(v) => onMapping({ amountColumn: v })} disabled={disabled} />
            </Field>
            <SegmentedControl
              label="Arti nilai positif"
              value={mapping.amountPositiveIsIncome ? "in" : "out"}
              options={DIRECTION_OPTIONS}
              onValueChange={(v) => onMapping({ amountPositiveIsIncome: v === "in" })}
              className="w-full"
            />
          </>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-small font-medium text-primary">
          Pemisah desimal
        </span>
        <SegmentedControl
          label="Pemisah desimal"
          value={mapping.decimalSeparator}
          options={DECIMAL_OPTIONS}
          onValueChange={(v) => onMapping({ decimalSeparator: v })}
          className="w-full"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="Kolom saldo (opsional)">
          <Select value={selected(mapping.balanceColumn, true)} options={optional} onValueChange={(v) => onMapping({ balanceColumn: picked(v) })} disabled={disabled} />
        </Field>
        <Field label="Kolom jam (opsional)">
          <Select value={selected(mapping.timeColumn, true)} options={optional} onValueChange={(v) => onMapping({ timeColumn: picked(v) })} disabled={disabled} />
        </Field>
      </div>

      <details className="group flex flex-col gap-3">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-control text-secondary hover:text-primary [&::-webkit-details-marker]:hidden">
          <Icon icon={ChevronRight} className="transition-transform duration-(--dur-fast) group-open:rotate-90" />
          Encoding dan pemisah kolom
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Encoding" description="Ganti kalau huruf seperti é tampil rusak.">
            <Select value={mapping.encoding} options={ENCODING_OPTIONS} onValueChange={(v) => onLayout({ encoding: v as CsvMapping["encoding"] })} disabled={disabled} />
          </Field>
          <Field label="Pemisah kolom">
            <Select value={mapping.delimiter} options={DELIMITER_OPTIONS} onValueChange={(v) => onLayout({ delimiter: v as CsvMapping["delimiter"] })} disabled={disabled} />
          </Field>
        </div>
      </details>
    </div>
  );
}
