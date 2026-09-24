"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type PaydayInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
};

/** Angka 1-31 sebagai teks supaya kolom boleh kosong sementara diketik. */
export function parsePaydayText(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const day = Number(text.trim());
  return day >= 1 && day <= 31 ? day : null;
}

export function PaydayInput({ value, onChange, error }: PaydayInputProps) {
  return (
    <Field
      label="Tanggal gajian"
      error={error}
      description="Tanggal yang tidak ada di bulan tertentu jatuh ke hari terakhir bulan itu, misalnya 31 menjadi 30 September."
    >
      <Input
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        className="max-w-24"
      />
    </Field>
  );
}
