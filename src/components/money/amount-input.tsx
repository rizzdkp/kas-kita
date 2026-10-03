"use client";

import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef } from "react";
import { formatAmountInput, parseAmount } from "@/lib/money";
import { cn } from "@/components/ui/cn";
import { useFieldControl } from "@/components/ui/field";
import { controlBase } from "@/components/ui/input";

type AmountInputProps = Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Teks mentah yang terlihat di input (terkendali). */
  value?: string;
  defaultValue?: string;
  /** Teks terformat dan hasil parse; amount null kalau teks belum valid. */
  onValueChange?: (text: string, amount: bigint | null) => void;
  invalid?: boolean;
};

function digitsBefore(text: string, caret: number): number {
  return text.slice(0, caret).replace(/\D/g, "").length;
}

function caretAfterDigits(text: string, count: number): number {
  if (count === 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i] ?? "")) seen++;
    if (seen === count) return i + 1;
  }
  return text.length;
}

/** Input nominal: keyboard angka di mobile, "25000" menjadi "25.000" saat diketik, menerima rb/jt/k. */
export function AmountInput({
  value,
  defaultValue = "",
  onValueChange,
  invalid,
  className,
  id,
  ref: forwardedRef,
  ...rest
}: AmountInputProps) {
  const field = useFieldControl();
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const node = inputRef.current;
    if (node && pendingCaret.current !== null && document.activeElement === node) {
      node.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [text]);

  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-secondary">
        Rp
      </span>
      <input
        ref={(node) => {
          inputRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        id={id ?? field?.controlId}
        aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
        aria-invalid={isInvalid || undefined}
        required={rest.required ?? field?.required}
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          const caret = event.target.selectionStart ?? raw.length;
          const formatted = formatAmountInput(raw);
          pendingCaret.current = caretAfterDigits(formatted, digitsBefore(raw, caret));
          if (value === undefined) setInner(formatted);
          onValueChange?.(formatted, parseAmount(formatted));
        }}
        className={cn(controlBase, "tabular h-11 pl-10 pr-3 sm:h-10")}
        {...rest}
      />
    </div>
  );
}
