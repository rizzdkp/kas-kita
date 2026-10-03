"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onCheckedChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4 sm:min-h-10", className)}>
      <span className="flex flex-col">
        <label htmlFor={id} className="text-body text-primary">
          {label}
        </label>
        {description ? (
          <span id={`${id}-desc`} className="text-small text-secondary">
            {description}
          </span>
        ) : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border p-0.5",
          "transition-colors duration-(--dur-fast) ease-(--ease-out)",
          "disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)",
          checked ? "border-accent bg-accent" : "border-border-strong bg-surface-sunken",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-6 rounded-pill bg-surface shadow-[var(--glass-active-shadow)]",
            "transition-transform duration-(--dur-spring) ease-(--ease-spring-glass) motion-reduce:transition-none",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
