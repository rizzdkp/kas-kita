"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PreviewCard, type PartyColors } from "./preview-card";
import { missingFields, missingReason, type PreviewPatch } from "./preview-model";
import type { PreviewField, PreviewItem, QuickAddContextData } from "./types";

type PreviewStackProps = {
  items: PreviewItem[];
  ctx: QuickAddContextData;
  colors: PartyColors;
  now: Date;
  saving: boolean;
  /** Error yang tidak menunjuk kartu tertentu. */
  error: string | null;
  onChange: (clientId: string, patch: PreviewPatch) => void;
  onRemove: (clientId: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("button, input, textarea, select, [role=combobox]") !== null;
}

/**
 * Kartu pratinjau di atas bar quick-add. Permukaan solid, bukan glass: popover pengedit field
 * memakai glass regular, dan DESIGN 5.1 melarang glass di atas glass.
 */
export function PreviewStack({ items, ctx, colors, now, saving, error, onChange, onRemove, onSave, onCancel }: PreviewStackProps) {
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const reasonId = useId();
  const count = items.length;
  const missingPerItem = items.map((i) => missingFields(i, ctx));
  const incomplete = missingPerItem.findIndex((m) => m.length > 0);
  const allMissing = [...new Set(missingPerItem.flat())] as PreviewField[];
  const reason = missingReason(allMissing);
  const reasonText =
    reason && count > 1 ? `Baris ${incomplete + 1}: ${missingReason(missingPerItem[incomplete] ?? [])}` : reason;

  // fokus pindah ke kartu supaya Enter langsung menyimpan dan Esc membatalkan
  useEffect(() => {
    saveRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // event dari popover yang di-portal ikut naik lewat pohon React; hanya tangani yang ada di DOM kartu
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target) || event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && !isInteractive(event.target)) {
      event.preventDefault();
      if (!reason && !saving) onSave();
    }
  };

  return (
    <div
      role="region"
      aria-label={count > 1 ? `Pratinjau ${count} transaksi` : "Pratinjau transaksi"}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="kk-pop flex max-h-[min(60dvh,520px)] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-glass outline-none"
    >
      <div className="min-h-0 overflow-y-auto">
        {items.map((item, index) => (
          <PreviewCard
            key={item.clientId}
            item={item}
            ctx={ctx}
            colors={colors}
            now={now}
            index={index}
            total={count}
            onChange={(patch) => onChange(item.clientId, patch)}
            onRemove={() => onRemove(item.clientId)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-sunken px-3 py-2 sm:px-4">
        {error ? (
          <p role="alert" className="mr-auto flex items-start gap-1.5 text-small text-error">
            <Icon icon={CircleAlert} size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        {reasonText ? (
          <p id={reasonId} className="mr-auto flex items-start gap-1.5 text-small text-secondary">
            <Icon icon={CircleAlert} size={16} className="mt-0.5 shrink-0" />
            <span>{reasonText}</span>
          </p>
        ) : null}
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button
          ref={saveRef}
          variant="primary"
          onClick={() => {
            if (!reason) onSave();
          }}
          // aria-disabled, bukan disabled, supaya tombol tetap bisa difokus dan alasannya terbaca
          aria-disabled={reason ? true : undefined}
          loading={saving}
          aria-describedby={reasonText ? reasonId : undefined}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-(--disabled-opacity)"
        >
          {count > 1 ? "Simpan semua" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
