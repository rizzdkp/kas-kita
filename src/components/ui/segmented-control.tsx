"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "./cn";
import { selectWithArrows } from "./radio-arrows";

export type SegmentOption<V extends string> = { value: V; label: string; disabled?: boolean };

type SegmentedControlProps<V extends string> = {
  value: V;
  onValueChange: (value: V) => void;
  options: readonly SegmentOption<V>[];
  /** Nama grup untuk pembaca layar. */
  label: string;
  className?: string;
};

/** Pilihan tunggal di area konten (solid). Toggle cakupan memakai ScopeToggle, bukan ini. */
export function SegmentedControl<V extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<V>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => {
        const match = options.find((o) => o.value === next);
        if (match) onValueChange(match.value);
      }}
      onKeyDownCapture={(event) =>
        selectWithArrows(
          event,
          options.filter((o) => !o.disabled).map((o) => o.value),
          value,
          onValueChange,
        )
      }
      aria-label={label}
      orientation="horizontal"
      className={cn("inline-flex h-11 rounded-md border border-border bg-surface-sunken p-1 sm:h-10", className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xs px-3 text-control text-secondary",
            "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-primary",
            "data-[state=checked]:bg-surface data-[state=checked]:text-primary data-[state=checked]:shadow-[0_0_0_1px_var(--border)]",
            "disabled:opacity-(--disabled-opacity)",
          )}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
