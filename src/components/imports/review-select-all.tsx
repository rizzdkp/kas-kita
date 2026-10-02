"use client";

import { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

type Props = {
  checked: number;
  total: number;
  onChange: (checked: boolean) => void;
};

/** Centang semua baris Baru; setengah tercentang tampil sebagai garis (indeterminate). */
export function SelectAllNew({ checked, total, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const all = checked === total;
  const some = checked > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <label className="group inline-flex min-h-11 cursor-pointer items-center gap-3 self-start sm:min-h-10">
      <span className="relative ml-3 inline-flex size-5 sm:ml-2.5">
        <input
          ref={ref}
          type="checkbox"
          checked={all}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface",
            "transition-colors duration-(--dur-fast) ease-(--ease-out) group-hover:border-accent",
            "checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent",
          )}
        />
        <Icon icon={some ? Minus : Check} size={16} className="pointer-events-none absolute left-0.5 top-0.5 text-on-accent opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-100" />
      </span>
      <span className="text-control text-primary">Centang semua baris baru</span>
      <span className="text-small text-secondary tabular">
        {checked} dari {total}
      </span>
    </label>
  );
}
