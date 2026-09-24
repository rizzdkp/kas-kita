"use client";

import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "@/components/ui/cn";
import { useFieldControl } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { controlBase } from "@/components/ui/input";

export interface GroupedOption {
  value: string;
  label: string;
  /** Teks di pemicu kalau berbeda dari label (misalnya "Induk › Anak"). */
  selectedLabel?: string;
  leading?: ReactNode;
  /** Anak kategori: diberi indentasi. */
  nested?: boolean;
}

export interface OptionGroup {
  label?: string;
  options: GroupedOption[];
}

type GroupedSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  groups: OptionGroup[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
};

/** Select dengan grup berlabel dan anak berindentasi (akun per pemilik, pohon kategori dua tingkat). */
export function GroupedSelect({ value, onValueChange, groups, placeholder, className, disabled, ...aria }: GroupedSelectProps) {
  const field = useFieldControl();
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={field?.controlId}
        aria-label={aria["aria-label"]}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(controlBase, "flex h-11 items-center justify-between gap-2 pl-3 pr-2 text-left sm:h-10", "data-placeholder:text-secondary", className)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.leading}
          <span className="truncate">
            <SelectPrimitive.Value placeholder={placeholder}>{selected ? (selected.selectedLabel ?? selected.label) : undefined}</SelectPrimitive.Value>
          </span>
        </span>
        <SelectPrimitive.Icon className="text-secondary">
          <Icon icon={ChevronDown} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content asChild position="popper" sideOffset={6} collisionPadding={12}>
          <GlassSurface
            variant="regular"
            className="kk-pop z-60 max-h-[min(var(--radix-select-content-available-height),420px)] min-w-(--radix-select-trigger-width) overflow-hidden p-1"
          >
            <SelectPrimitive.Viewport>
              {groups.map((group, gi) => (
                <SelectPrimitive.Group key={group.label ?? gi}>
                  {group.label ? (
                    <SelectPrimitive.Label className="px-3 pb-1 pt-3 text-caption text-secondary">{group.label}</SelectPrimitive.Label>
                  ) : null}
                  {group.options.map((option) => (
                    <SelectPrimitive.Item
                      key={option.value}
                      value={option.value}
                      className={cn(
                        "relative flex h-11 cursor-default select-none items-center gap-2 rounded-md pr-9 text-control text-primary outline-none sm:h-10",
                        option.nested ? "pl-9" : "pl-3",
                        "data-highlighted:bg-glass-active",
                      )}
                    >
                      {option.leading}
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
