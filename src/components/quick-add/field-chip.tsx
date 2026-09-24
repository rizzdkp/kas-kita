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
  children?: ReactNode;
};

export const chipClassName =
  "inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-left text-control text-primary sm:min-h-8 " +
  "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken " +
  "data-[state=open]:bg-surface-sunken";

/** Satu field di kartu pratinjau; klik untuk mengubah. */
export function FieldChip({ field, missing = false, missingText, children, className, ...rest }: FieldChipProps) {
  return (
    <button
      type="button"
      data-missing={missing || undefined}
      className={cn(
        chipClassName,
        missing && "border border-dashed border-error text-error hover:bg-error/10",
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
        children
      )}
    </button>
  );
}
