"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { commitButtonLabel, type ChoiceCounts } from "./review-model";

type Props = {
  counts: ChoiceCounts;
  error: string | null;
  pending: boolean;
  onCommit: () => void;
  onDiscard: () => void;
};

/** Ringkasan keputusan dan tombol simpan; menempel di bawah toolbar supaya tidak perlu menggulir balik. */
export function ReviewSummary({ counts, error, pending, onCommit, onDiscard }: Props) {
  const nothing = counts.imported === 0 && counts.linked === 0;
  return (
    <div className="sticky top-[calc(68px+env(safe-area-inset-top))] z-10 flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:top-24 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-body text-primary tabular" aria-live="polite">
          {counts.imported} diimpor · {counts.linked} ditautkan · {counts.skipped} dilewati
        </p>
        {error ? (
          <p role="alert" className="flex items-center gap-1 text-small text-error">
            <Icon icon={CircleAlert} size={16} className="shrink-0" />
            <span>{error}</span>
          </p>
        ) : nothing ? (
          <p className="text-small text-secondary">Centang baris yang ingin diimpor.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button variant="ghost" onClick={onDiscard} disabled={pending}>
          Batalkan impor
        </Button>
        <Button variant="primary" onClick={onCommit} loading={pending} disabled={nothing}>
          {commitButtonLabel(counts)}
        </Button>
      </div>
    </div>
  );
}
