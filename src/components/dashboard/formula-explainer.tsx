"use client";

import { Calculator } from "lucide-react";
import { formatDateWithYear, parseDateKey } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";

export type FormulaInputs = Record<string, bigint | number | string>;

export interface FormulaItem {
  /** Nama metrik, misalnya "Aman dibelanjakan". */
  label: string;
  /** Rumus dari metric.formula. */
  formula: string;
  /** Angka asli dari metric.inputs. */
  inputs: FormulaInputs;
  /** Hasil yang tampil di halaman, sudah diformat. */
  result?: string;
}

type FormulaExplainerProps = {
  /** Judul panel. */
  title: string;
  items: FormulaItem[];
  /** "button": tombol teks "Cara menghitung"; "icon": tombol ikon untuk kepala bagian. */
  trigger?: "button" | "icon";
  className?: string;
};

const numberFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function formatFormulaInput(value: bigint | number | string): string {
  if (typeof value === "bigint") return formatRupiah(value);
  if (typeof value === "number") return numberFormatter.format(value).replace("-", "−");
  const day = parseDateKey(value);
  return day ? formatDateWithYear(day) : value;
}

/** Panel "Cara menghitung" (PRD bagian 6): rumus dan angka asli setiap metrik di bagian itu. */
export function FormulaExplainer({ title, items, trigger = "button", className }: FormulaExplainerProps) {
  const triggerNode = (
    <SheetTrigger
      className={cn(
        trigger === "button"
          ? "-ml-2 inline-flex h-11 items-center gap-2 rounded-md px-2 text-small text-secondary hover:bg-surface-sunken hover:text-primary sm:h-8"
          : "inline-flex size-11 items-center justify-center rounded-sm text-secondary hover:bg-surface-sunken hover:text-primary sm:size-8",
        "transition-colors duration-(--dur-fast) ease-(--ease-out)",
        className,
      )}
      aria-label={trigger === "icon" ? `Cara menghitung ${title.toLowerCase()}` : undefined}
    >
      <Icon icon={Calculator} size={16} className="shrink-0" />
      {trigger === "button" ? "Cara menghitung" : null}
    </SheetTrigger>
  );
  return (
    <Sheet>
      {trigger === "icon" ? <Tooltip content="Cara menghitung">{triggerNode}</Tooltip> : triggerNode}
      <SheetContent title={title} description="Dihitung Kas Kita dari data kalian, bukan AI.">
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <section key={item.label} className="flex flex-col gap-2">
              <h3 className="text-card text-primary">{item.label}</h3>
              <p className="text-small text-secondary">{item.formula}</p>
              {/* angka di atas permukaan solid, tidak langsung di atas glass (DESIGN 5.1) */}
              <dl className="flex flex-col rounded-md bg-surface px-3 py-1">
                {Object.entries(item.inputs).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
                    <dt className="min-w-0 text-small text-secondary">{key}</dt>
                    <dd className="tabular shrink-0 text-right text-small text-primary">{formatFormulaInput(value)}</dd>
                  </div>
                ))}
                {item.result !== undefined ? (
                  <div className="flex items-baseline justify-between gap-4 border-t border-border-strong py-2">
                    <dt className="text-small font-medium text-primary">Hasil</dt>
                    <dd className="tabular text-right text-small font-medium text-primary">{item.result}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
