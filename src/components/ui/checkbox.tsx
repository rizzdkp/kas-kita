"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";
import { Icon } from "./icon";

type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type"> & { label: ReactNode; description?: ReactNode };

/** Checkbox native (tanpa Radix) supaya ikut form dan keyboard bawaan browser. */
export function Checkbox({ label, description, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label
      className={cn(
        "group inline-flex min-h-11 cursor-pointer items-start gap-3 py-2 sm:min-h-10",
        disabled && "cursor-not-allowed opacity-(--disabled-opacity)",
        className,
      )}
    >
      <span className="relative inline-flex h-6 w-5 shrink-0 items-center">
        <input
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer size-5 cursor-[inherit] appearance-none rounded-xs border border-border-strong bg-surface",
            "transition-colors duration-(--dur-fast) ease-(--ease-out)",
            "checked:border-accent checked:bg-accent group-hover:border-accent",
          )}
          {...rest}
        />
        <Icon
          icon={Check}
          size={16}
          className="pointer-events-none absolute left-0.5 top-1 text-on-accent opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="flex flex-col">
        <span className="text-body text-primary">{label}</span>
        {description ? <span className="text-small text-secondary">{description}</span> : null}
      </span>
    </label>
  );
}
