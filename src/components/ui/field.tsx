"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "./cn";
import { Icon } from "./icon";

type FieldContextValue = {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Dipakai Input, Textarea, Select, AmountInput untuk menyambung label, keterangan, dan error. */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}

type FieldProps = {
  label: string;
  description?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** Sembunyikan label secara visual, tetap terbaca pembaca layar. */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({ label, description, error, required = false, hideLabel, className, children }: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const descriptionId = description ? `${base}-desc` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [errorId, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ controlId, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-2", className)}>
        <label htmlFor={controlId} className={cn("text-small font-medium text-primary", hideLabel && "sr-only")}>
          {label}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="flex items-center gap-1 text-small text-error">
            <Icon icon={CircleAlert} size={16} className="shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        {description ? (
          <p id={descriptionId} className="text-small text-secondary">
            {description}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
