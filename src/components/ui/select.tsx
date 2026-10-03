"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "./cn";
import { useFieldControl } from "./field";
import { Icon } from "./icon";
import { controlBase } from "./input";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  /** Wajib kalau Select tidak dibungkus Field. */
  "aria-label"?: string;
  className?: string;
};

export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  name,
  className,
  ...aria
}: SelectProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
      required={field?.required}
    >
      <SelectPrimitive.Trigger
        id={field?.controlId}
        aria-label={aria["aria-label"]}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid || undefined}
        className={cn(
          controlBase,
          "flex h-11 items-center justify-between gap-2 pl-3 pr-2 text-left sm:h-10",
          "data-placeholder:text-secondary",
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon className="text-secondary">
          <Icon icon={ChevronDown} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content asChild position="popper" sideOffset={6} collisionPadding={12}>
          <GlassSurface
            variant="regular"
            className="kk-pop z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden p-1"
          >
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "relative flex h-11 cursor-default select-none items-center rounded-md pl-3 pr-9 text-control text-primary outline-none sm:h-10",
                    "data-highlighted:bg-glass-active data-disabled:opacity-(--disabled-opacity)",
                  )}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex">
                    <Icon icon={Check} size={16} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </GlassSurface>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
