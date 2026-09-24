import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPercent, formatRupiah, percentOf } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { BarTrack } from "@/components/charts/bar-track";
import { FormulaExplainer } from "@/components/dashboard/formula-explainer";
import { SectionCard } from "@/components/dashboard/section-card";
import { Amount } from "@/components/money/amount";
import { Delta } from "@/components/money/delta";
import { Icon } from "@/components/ui/icon";
import type { Metric } from "@/server/metrics/types";
import type { CategoryWithPrevious, ReportRange } from "@/server/queries/reports";
import { transactionHref, type TransactionKind } from "./transaction-link";

type CategoryListProps = {
  id: string;
  title: string;
  kind: Extract<TransactionKind, "income" | "expense">;
  categories: Metric<CategoryWithPrevious[]>;
  range: ReportRange;
  previousLabel: string;
  scope: Scope;
  className?: string;
};

function share(part: bigint, whole: bigint): number {
  return whole === 0n ? 0 : Number((part * 1000n) / whole) / 10;
}

/** Kategori berurutan; setiap baris membuka Transaksi dengan filter kategori dan periode (F-REP-1 AC1). */
export function CategoryList({ id, title, kind, categories, range, previousLabel, scope, className }: CategoryListProps) {
  const rows = categories.value;
  const total = rows.reduce((s, r) => s + r.total, 0n);
  const max = rows[0]?.total ?? 0n;
  const empty = kind === "expense" ? `Belum ada pengeluaran ${range.label}.` : `Belum ada pemasukan ${range.label}.`;
  return (
    <SectionCard
      id={id}
      title={title}
      className={className}
      action={
        <FormulaExplainer
          trigger="icon"
          title={title}
          items={[{ label: title, formula: categories.formula, inputs: categories.inputs, result: formatRupiah(total) }]}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-small text-secondary">{empty}</p>
      ) : (
        <ul className="-mx-2 flex flex-col" data-testid={`${id}-list`}>
          {rows.map((c) => {
            const change = percentOf(c.total - c.previous, c.previous);
            return (
              <li key={c.categoryId}>
                <Link
                  href={transactionHref({ scope, categoryIds: [c.categoryId], kinds: [kind], from: range.from, to: range.to })}
                  className="group flex items-center gap-2 rounded-md px-2 py-3 hover:bg-surface-sunken"
                  data-category-id={c.categoryId}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-body text-primary">{c.name}</span>
                      <Amount value={c.total} className="shrink-0 text-body text-primary" />
                    </span>
                    <BarTrack percent={share(c.total, max)} />
                    <span className="flex flex-wrap justify-between gap-x-3 text-caption text-secondary">
                      <span className="tabular">{formatPercent(percentOf(c.total, total) ?? 0)} dari total</span>
                      {change === null ? (
                        <span>Tidak ada di {previousLabel}</span>
                      ) : (
                        <Delta percent={change} comparedTo={previousLabel} className="text-caption" />
                      )}
                    </span>
                  </span>
                  <Icon icon={ChevronRight} size={16} className="shrink-0 text-tertiary group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
