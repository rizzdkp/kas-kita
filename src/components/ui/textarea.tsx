"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { useFieldControl } from "./field";
import { controlBase } from "./input";

export type TextareaProps = ComponentPropsWithRef<"textarea"> & { invalid?: boolean };

export function Textarea({ className, invalid, id, rows = 3, ...rest }: TextareaProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      id={id ?? field?.controlId}
      rows={rows}
      aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
      aria-invalid={isInvalid || undefined}
      required={rest.required ?? field?.required}
      className={cn(controlBase, "min-h-24 resize-y px-3 py-2", className)}
      {...rest}
    />
  );
}
