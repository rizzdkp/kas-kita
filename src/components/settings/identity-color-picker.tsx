"use client";

import { useId } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import { IDENTITY_COLORS, type IdentityColor } from "@/server/db/schema/users";
import { identityColorVar } from "@/components/identity/identity-colors";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { selectWithArrows } from "@/components/ui/radio-arrows";
import { IDENTITY_COLOR_NAMES } from "./identity-color-names";

type IdentityColorPickerProps = {
  value: IdentityColor;
  onChange: (color: IdentityColor) => void;
  /** Warna partner tidak bisa dipilih (DESIGN 2.2). */
  partner: { name: string; color: IdentityColor } | null;
  error?: string | null;
  className?: string;
};

function isIdentityColor(value: string): value is IdentityColor {
  return (IDENTITY_COLORS as readonly string[]).includes(value);
}

/** Enam warna identitas sebagai radiogroup; setiap pilihan menulis namanya supaya tidak hanya dibawa warna. */
export function IdentityColorPicker({ value, onChange, partner, error, className }: IdentityColorPickerProps) {
  const descriptionId = useId();
  const selectable = IDENTITY_COLORS.filter((c) => c !== partner?.color);
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="pb-2 text-small font-medium text-primary">Warna identitas</legend>
      <RadioGroup.Root
        value={value}
        onValueChange={(next) => {
          if (isIdentityColor(next)) onChange(next);
        }}
        onKeyDownCapture={(event) => selectWithArrows(event, selectable, value, onChange)}
        aria-label="Warna identitas"
        aria-describedby={descriptionId}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {IDENTITY_COLORS.map((color) => {
          const taken = partner?.color === color;
          return (
            <RadioGroup.Item
              key={color}
              value={color}
              disabled={taken}
              aria-label={taken ? `${IDENTITY_COLOR_NAMES[color]}, dipakai ${partner?.name}` : IDENTITY_COLOR_NAMES[color]}
              className={cn(
                "group flex min-h-13 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left",
                "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:border-border-strong",
                "data-[state=checked]:border-accent data-[state=checked]:shadow-[inset_0_0_0_1px_var(--accent)]",
                "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:hover:border-border",
              )}
            >
              <span
                aria-hidden
                className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-pill group-disabled:opacity-(--disabled-opacity)"
                style={{ background: identityColorVar(color) }}
              >
                <Icon icon={Check} size={16} className="hidden text-on-accent group-data-[state=checked]:block" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-control text-primary">{IDENTITY_COLOR_NAMES[color]}</span>
                {taken ? <span className="truncate text-small text-secondary">Dipakai {partner?.name}</span> : null}
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>
      <p id={descriptionId} className="text-small text-secondary">
        Menandai data milikmu: titik di transaksi, cincin avatar, dan warna latar saat cakupan Saya.
      </p>
      {error ? <p className="text-small text-error">{error}</p> : null}
    </fieldset>
  );
}
