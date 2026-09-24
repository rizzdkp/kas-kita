"use client";

import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, CircleAlert } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { AiMark, chipClassName } from "./field-chip";

export type ChipOption = { value: string; label: string; indent?: boolean };
export type ChipOptionGroup = { label?: string; options: ChipOption[] };

type ChipSelectProps = {
  field: string;
  value: string | null;
  onValueChange: (value: string) => void;
  groups: ChipOptionGroup[];
  missing?: boolean;
  missingText?: string;
  /** Isi chip saat terisi; bawaan label opsi terpilih. */
  display?: ReactNode;
  disabled?: boolean;
  /** Nilai diisi model AI. */
  ai?: boolean;
};

/** Pilihan satu nilai yang pemicunya berupa chip di kartu pratinjau. */
export function ChipSelect({ field, value, onValueChange, groups, missing, missingText, display, disabled, ai }: ChipSelectProps) {
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);
  return (
    <SelectPrimitive.Root value={value ?? ""} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={field}
        data-missing={missing || undefined}
        data-ai={(ai && !missing) || undefined}
        className={cn(chipClassName(missing), disabled && "pointer-events-none")}
      >
        {missing ? (
          <>
            <Icon icon={CircleAlert} size={16} />
            <span>{missingText}</span>
          </>
        ) : (
          <>
            {display ?? <span>{selected?.label}</span>}
            {ai ? <AiMark /> : null}
          </>
        )}
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content asChild position="popper" sideOffset={6} collisionPadding={12}>
          <GlassSurface
            variant="regular"
            className="kk-pop z-50 max-h-[min(360px,var(--radix-select-content-available-height))] min-w-56 overflow-hidden p-1"
          >
            <SelectPrimitive.Viewport>
              {groups.map((group, gi) => (
                <SelectPrimitive.Group key={group.label ?? gi}>
                  {group.label ? (
                    <SelectPrimitive.Label className="px-3 pb-1 pt-2 text-caption text-secondary">{group.label}</SelectPrimitive.Label>
                  ) : null}
                  {group.options.map((option) => (
                    <SelectPrimitive.Item
                      key={option.value}
                      value={option.value}
                      className={cn(
                        "relative flex h-11 cursor-default select-none items-center rounded-md pr-9 text-control text-primary outline-none sm:h-10",
                        option.indent ? "pl-6" : "pl-3",
                        "data-highlighted:bg-glass-active",
                      )}
                    >
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex">
                        <Icon icon={Check} size={16} />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              ))}
            </SelectPrimitive.Viewport>
          </GlassSurface>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
