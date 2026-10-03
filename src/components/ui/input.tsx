"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// placeholder memakai text-secondary karena text-tertiary di atas surface tidak lolos 4,5:1
export const controlBase =
  "w-full rounded-md border border-border bg-surface text-body text-primary placeholder:text-secondary " +
  "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:border-border-strong " +
  "aria-invalid:border-error disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)";

export type InputProps = ComponentPropsWithRef<"input"> & { invalid?: boolean };

export function Input({ className, invalid, id, ...rest }: InputProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <input
      id={id ?? field?.controlId}
      aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
      aria-invalid={isInvalid || undefined}
      required={rest.required ?? field?.required}
      className={cn(controlBase, "h-11 px-3 sm:h-10", className)}
      {...rest}
    />
  );
}
