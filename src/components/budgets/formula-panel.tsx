"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

type FormulaPanelProps = {
  formula: string;
  inputs: Record<string, bigint | number | string>;
  className?: string;
};

function formatInput(v: bigint | number | string): string {
  if (typeof v === "bigint") return formatRupiah(v);
  if (typeof v === "number") return new Intl.NumberFormat("id-ID").format(v);
  return v;
}

/** Panel "Cara menghitung": rumus dan angka aslinya (PRD bagian 6). */
export function FormulaPanel({ formula, inputs, className }: FormulaPanelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="-mx-2 inline-flex h-11 items-center gap-1 rounded-md px-2 text-control text-accent hover:bg-surface-sunken sm:h-10"
      >
        Cara menghitung
        <Icon icon={ChevronDown} size={16} className={cn("transition-transform duration-(--dur-fast)", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={id} className="mt-2 flex flex-col gap-3">
          <p className="max-w-[65ch] text-small text-secondary">{formula}</p>
          <table className="w-full text-small">
            <tbody>
              {Object.entries(inputs).map(([label, value]) => (
                <tr key={label} className="border-t border-border">
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-secondary">
                    {label}
                  </th>
                  <td className="py-2 text-right text-primary">{formatInput(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
