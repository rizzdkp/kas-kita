"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "@/components/ui/cn";
import { selectWithArrows } from "@/components/ui/radio-arrows";
import type { SaveMode } from "./receipt-form-model";

const OPTIONS: ReadonlyArray<{ value: SaveMode; label: string; hint: string }> = [
  { value: "single", label: "Simpan sebagai satu transaksi", hint: "Satu kategori untuk seluruh struk." },
  { value: "split", label: "Pecah per kategori", hint: "Tetap satu transaksi, nominalnya dirinci per kategori item." },
];

/** Pilihan simpan UX-FLOWS 5 langkah 5; radiogroup dengan navigasi panah. */
export function SaveModeChoice({ value, onValueChange }: { value: SaveMode; onValueChange: (mode: SaveMode) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span id="struk-cara-simpan" className="text-small font-medium text-primary">
        Cara simpan
      </span>
      <RadioGroup.Root
        aria-labelledby="struk-cara-simpan"
        value={value}
        onValueChange={(next) => onValueChange(next === "split" ? "split" : "single")}
        onKeyDownCapture={(event) => selectWithArrows(event, OPTIONS.map((o) => o.value), value, onValueChange)}
        className="grid gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              "group flex items-start gap-3 rounded-md border border-border bg-surface p-3 text-left",
              "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:border-border-strong",
              "data-[state=checked]:border-accent data-[state=checked]:bg-surface-sunken",
            )}
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-pill border border-border-strong group-data-[state=checked]:border-accent"
            >
              <span className="size-2 rounded-pill bg-accent opacity-0 group-data-[state=checked]:opacity-100" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-control text-primary">{option.label}</span>
              <span className="text-small text-secondary">{option.hint}</span>
            </span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>
  );
}
