import { ChevronRight } from "lucide-react";
import { Amount } from "@/components/money/amount";
import { Icon } from "@/components/ui/icon";
import type { ReviewRow } from "@/server/queries/import-review";
import { rowDateLabel } from "./review-row-fields";

/** Duplikat pasti disembunyikan secara default (F-IN-6 AC3); hanya jumlahnya yang terlihat. */
export function ReviewExactList({ rows }: { rows: ReviewRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group rounded-card border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-card px-4 py-3 text-control text-primary sm:px-5 [&::-webkit-details-marker]:hidden">
        <Icon icon={ChevronRight} size={16} className="text-secondary transition-transform duration-(--dur-fast) ease-(--ease-out) group-open:rotate-90" />
        <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <span>Duplikat pasti ({rows.length})</span>
          <span className="text-small text-secondary">sudah pernah diimpor, tidak diimpor lagi</span>
        </span>
      </summary>
      <ul className="border-t border-border px-4 sm:px-5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
            <span className="flex min-w-0 flex-col">
              <span className="break-words text-body text-secondary">{row.description}</span>
              <span className="text-caption text-secondary">{rowDateLabel(row)}</span>
            </span>
            <Amount value={row.amount} sign="always" className="text-secondary" />
          </li>
        ))}
      </ul>
    </details>
  );
}
