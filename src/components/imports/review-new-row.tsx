"use client";

import { memo } from "react";
import { Amount } from "@/components/money/amount";
import type { BeneficiaryChoice } from "@/components/transactions/labels";
import type { People } from "@/components/transactions/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import type { ReviewRow } from "@/server/queries/import-review";
import { ReviewRowFields, RowCheckbox, rowDateLabel, rowSpokenLabel, type CategoryOptionGroups } from "./review-row-fields";

type Props = {
  row: ReviewRow;
  checked: boolean;
  categoryId: string | null;
  who: BeneficiaryChoice;
  invalid: boolean;
  categoryGroups: CategoryOptionGroups;
  people: People;
  sharedAccount: boolean;
  onToggle: (rowId: string, checked: boolean) => void;
  onCategory: (rowId: string, categoryId: string) => void;
  onWho: (rowId: string, who: BeneficiaryChoice) => void;
};

/**
 * Satu baris Baru. Layar lebar: centang, tanggal, deskripsi, kategori, untuk siapa, nominal dalam satu grid.
 * Layar kecil: deskripsi dan nominal di atas, pilihan di bawah.
 */
export const ReviewNewRow = memo(function ReviewNewRow({
  row,
  checked,
  categoryId,
  who,
  invalid,
  categoryGroups,
  people,
  sharedAccount,
  onToggle,
  onCategory,
  onWho,
}: Props) {
  return (
    <li
      data-row-id={row.id}
      data-balance-mismatch={row.balanceMismatch || undefined}
      className={cn(
        "grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 border-b border-border py-3 last:border-b-0",
        "lg:grid-cols-[44px_72px_minmax(0,1fr)_minmax(0,420px)_136px] lg:items-center lg:gap-x-4",
        row.balanceMismatch && "-mx-2 rounded-md bg-attention/5 px-2",
      )}
    >
      <RowCheckbox checked={checked} onChange={(c) => onToggle(row.id, c)} label={`Impor ${rowSpokenLabel(row)}`} />
      <span className="hidden text-small text-secondary tabular lg:block">{rowDateLabel(row)}</span>
      <span className="flex min-w-0 flex-col gap-1 pt-2 lg:pt-0">
        <span className={cn("break-words text-body", checked ? "text-primary" : "text-secondary")}>{row.description}</span>
        <span className="flex flex-wrap items-center gap-2 text-caption text-secondary lg:hidden">{rowDateLabel(row)}</span>
        {row.balanceMismatch ? (
          <span>
            <Badge tone="attention">Perlu dicek</Badge>
          </span>
        ) : null}
      </span>
      <span className="pt-2 text-right lg:order-last lg:pt-0">
        <Amount value={row.amount} sign="always" className={checked ? "text-primary" : "text-secondary"} />
      </span>
      <ReviewRowFields
        row={row}
        categoryGroups={categoryGroups}
        people={people}
        sharedAccount={sharedAccount}
        categoryId={categoryId}
        who={who}
        invalid={invalid}
        onCategory={onCategory}
        onWho={onWho}
        className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-auto"
      />
    </li>
  );
});
