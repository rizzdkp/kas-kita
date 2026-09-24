"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

type FieldChipProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  /** Nama field untuk pembaca layar, misalnya "Akun". */
  field: string;
  /** Field wajib belum terisi: tampil dengan ikon dan teks, bukan hanya warna. */
  missing?: boolean;
  /** Teks saat kosong, misalnya "Pilih kategori". */
  missingText?: string;
  /** Nilai diisi model AI, bukan parser atau pengguna. */
  ai?: boolean;
  children?: ReactNode;
};

// isian sunken memberi tanda bisa diklik tanpa pemisah titik yang menggantung saat baris patah
const chipBase =
  "inline-flex min-h-11 items-center gap-1.5 rounded-sm border px-2.5 text-left text-control sm:min-h-8 " +
  "transition-colors duration-(--dur-fast) ease-(--ease-out)";
const chipFilled = "border-transparent bg-surface-sunken text-primary hover:border-border-strong data-[state=open]:border-border-strong";
const chipMissing = "border-dashed border-error text-error hover:bg-error/10 data-[state=open]:bg-error/10";

export function chipClassName(missing: boolean | undefined): string {
  return `${chipBase} ${missing ? chipMissing : chipFilled}`;
}

/** Penanda kecil field hasil AI; teks, bukan ikon, supaya terbaca tanpa legenda warna. */
export function AiMark() {
  return (
    <>
      <span aria-hidden className="text-caption font-medium text-secondary">
        AI
      </span>
      <span className="sr-only">, diisi AI</span>
    </>
  );
}

/** Satu field di kartu pratinjau; klik untuk mengubah. */
export function FieldChip({ field, missing = false, missingText, ai = false, children, className, ...rest }: FieldChipProps) {
  return (
    <button
      type="button"
      data-missing={missing || undefined}
      data-ai={(ai && !missing) || undefined}
      className={cn(
        chipClassName(missing),
        className,
      )}
      {...rest}
    >
      <span className="sr-only">{field}: </span>
      {missing ? (
        <>
          <Icon icon={CircleAlert} size={16} />
          <span>{missingText ?? `Isi ${field.toLowerCase()}`}</span>
        </>
      ) : (
        <>
          {children}
          {ai ? <AiMark /> : null}
        </>
      )}
    </button>
  );
}
