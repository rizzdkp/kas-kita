"use client";

import { memo, useId } from "react";
import { Check } from "lucide-react";
import { formatShortDate } from "@/lib/dates";
import { Amount } from "@/components/money/amount";
import type { BeneficiaryChoice } from "@/components/transactions/labels";
import type { People } from "@/components/transactions/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import type { ReviewRow } from "@/server/queries/import-review";
import type { RowAction } from "./review-model";
import { ReviewRowFields, rowDateLabel, type CategoryOptionGroups } from "./review-row-fields";

const ACTIONS: ReadonlyArray<{ value: RowAction; label: string }> = [
  { value: "link", label: "Sama, tautkan" },
  { value: "import", label: "Beda, impor sebagai baru" },
  { value: "skip", label: "Lewati" },
];

type Props = {
  row: ReviewRow;
  action: RowAction;
  categoryId: string | null;
  who: BeneficiaryChoice;
  invalid: boolean;
  categoryGroups: CategoryOptionGroups;
  people: People;
  sharedAccount: boolean;
  onAction: (rowId: string, action: RowAction) => void;
  onCategory: (rowId: string, categoryId: string) => void;
  onWho: (rowId: string, who: BeneficiaryChoice) => void;
};

/** Baris impor dan transaksi pembanding berdampingan (UX-FLOWS 6 langkah 4), lalu satu keputusan. */
export const ReviewDuplicateItem = memo(function ReviewDuplicateItem({
  row,
  action,
  categoryId,
  who,
  invalid,
  categoryGroups,
  people,
  sharedAccount,
  onAction,
  onCategory,
  onWho,
}: Props) {
  const name = useId();
  const match = row.match;
  if (!match) return null;
  const matchTitle = match.note || match.categoryName || "Transaksi";
  const matchDetail = [match.note ? match.categoryName : null, match.accountName].filter(Boolean).join(" · ");
  return (
    <li data-row-id={row.id} className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1 rounded-md bg-surface-sunken p-3">
          <span className="text-caption text-secondary">Dari mutasi</span>
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words text-body text-primary">{row.description}</span>
            <Amount value={row.amount} sign="always" />
          </div>
          <span className="text-caption text-secondary">{rowDateLabel(row)}</span>
          {row.balanceMismatch ? (
            <span>
              <Badge tone="attention">Perlu dicek</Badge>
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-3">
          <span className="text-caption text-secondary">Sudah tercatat</span>
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words text-body text-primary">{matchTitle}</span>
            {/* pembanding selalu senominal dan searah dengan baris impor (syarat dedupe) */}
            <Amount value={row.amount} sign="always" />
          </div>
          <span className="text-caption text-secondary">
            {formatShortDate(match.occurredAt)}
            {matchDetail ? ` · ${matchDetail}` : null}
            {` · diisi oleh ${match.createdByName}`}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-small text-secondary">{row.dayDiff === 0 ? "Tanggal sama" : `Selisih ${row.dayDiff} hari`}</span>
        <div role="radiogroup" aria-label={`Keputusan untuk ${row.description}`} className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <label
              key={a.value}
              className={cn(
                "inline-flex h-11 cursor-pointer items-center rounded-md border px-3 text-control transition-colors duration-(--dur-fast) ease-(--ease-out) sm:h-10",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                action === a.value ? "border-border-strong bg-surface text-primary" : "border-border bg-surface-sunken text-secondary hover:text-primary",
              )}
            >
              <input
                type="radio"
                name={name}
                value={a.value}
                checked={action === a.value}
                onChange={() => onAction(row.id, a.value)}
                className="sr-only"
              />
              {action === a.value ? <Icon icon={Check} size={16} className="mr-1" /> : null}
              {a.label}
            </label>
          ))}
        </div>
      </div>
      {action === "import" ? (
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
          className="sm:max-w-[520px]"
        />
      ) : null}
    </li>
  );
});
