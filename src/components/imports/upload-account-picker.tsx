"use client";

import type { IdentityColor } from "@/components/identity/identity-colors";
import { IdentityDot } from "@/components/identity/identity-dot";
import { cn } from "@/components/ui/cn";

export interface ImportAccountOption {
  id: string;
  name: string;
  /** "BCA · Bank · Kamu" */
  meta: string;
  dot: { color?: IdentityColor; shared?: [IdentityColor, IdentityColor]; label: string };
  /** Nama institusi bila templat CSV-nya sudah tersimpan. */
  templateFor: string | null;
}

type UploadAccountPickerProps = {
  accounts: ImportAccountOption[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
};

/** Radio native supaya panah dan spasi bekerja seperti bawaan browser. */
export function UploadAccountPicker({ accounts, value, onChange, disabled }: UploadAccountPickerProps) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-3 text-section text-primary">Akun tujuan</legend>
      <ul className="overflow-hidden rounded-card border border-border bg-surface">
        {accounts.map((account) => (
          <li key={account.id} className="border-b border-border last:border-b-0">
            <label
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 sm:px-(--space-card)",
                "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken",
                "has-checked:bg-surface-sunken has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent",
              )}
            >
              <input
                type="radio"
                name="akun-tujuan"
                value={account.id}
                checked={value === account.id}
                onChange={() => onChange(account.id)}
                className={cn(
                  "peer size-5 shrink-0 cursor-[inherit] appearance-none rounded-pill border border-border-strong bg-surface outline-none",
                  "transition-[border-width,border-color] duration-(--dur-fast) ease-(--ease-out)",
                  "checked:border-[6px] checked:border-accent",
                )}
              />
              <IdentityDot color={account.dot.color} shared={account.dot.shared} label={account.dot.label} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-card text-primary">{account.name}</span>
                <span className="truncate text-small text-secondary">{account.meta}</span>
              </span>
              {account.templateFor ? (
                <span className="hidden shrink-0 text-caption text-secondary sm:inline">Templat {account.templateFor} tersimpan</span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
