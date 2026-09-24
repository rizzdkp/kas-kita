import Link from "next/link";
import { formatRupiah } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { BarTrack } from "@/components/charts/bar-track";
import { Amount } from "@/components/money/amount";
import { transactionHref } from "@/components/reports/transaction-link";
import type { CategoryTotal } from "@/server/metrics/category-breakdown";
import type { Metric } from "@/server/metrics/types";
import { FormulaExplainer } from "./formula-explainer";
import { scopedHref } from "./links";
import { OwnerLegend } from "./owner-split";
import { ownerOrder, ownerStyle, type People } from "./people";
import { SectionCard } from "./section-card";

const MAX_ROWS = 8;

type CategorySectionProps = {
  categories: Metric<CategoryTotal[]>;
  scope: Scope;
  people: People;
  range: { from: string; to: string; label: string };
  className?: string;
};

function share(part: bigint, whole: bigint): number {
  return whole === 0n ? 0 : Number((part * 1000n) / whole) / 10;
}

/** Batang horizontal berurutan, label penuh; Gabungan bersegmen per pemilik (UX-FLOWS bagian 3.5). */
export function CategorySection({ categories, scope, people, range, className }: CategorySectionProps) {
  const rows = categories.value.slice(0, MAX_ROWS);
  const max = rows[0]?.total ?? 0n;
  const segmented = scope === "all";
  return (
    <SectionCard
      id="pengeluaran-kategori"
      className={className}
      title="Pengeluaran per kategori"
      action={
        <FormulaExplainer
          trigger="icon"
          title="Pengeluaran per kategori"
          items={[{ label: "Pengeluaran per kategori", formula: categories.formula, inputs: categories.inputs }]}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-small text-secondary">Belum ada pengeluaran {range.label}.</p>
      ) : (
        <>
          {segmented ? <OwnerLegend people={people} ownerIds={rows.flatMap((r) => r.byOwner.map((o) => o.ownerId))} /> : null}
          <ul className="-mx-2 flex flex-col">
            {rows.map((c) => {
              const owners = [...c.byOwner].sort((a, b) => ownerOrder(a.ownerId, people) - ownerOrder(b.ownerId, people));
              const breakdown = segmented
                ? owners.map((o) => `${ownerStyle(o.ownerId, people).name} ${formatRupiah(o.amount)}`).join(", ")
                : "";
              return (
                <li key={c.categoryId}>
                  <Link
                    href={transactionHref({ scope, categoryIds: [c.categoryId], from: range.from, to: range.to })}
                    className="flex flex-col gap-2 rounded-md px-2 py-2 hover:bg-surface-sunken"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-body text-primary">{c.name}</span>
                      <Amount value={c.total} className="shrink-0 text-body text-primary" />
                    </span>
                    <BarTrack
                      percent={share(c.total, max)}
                      segments={
                        segmented
                          ? owners.map((o) => ({
                              key: ownerStyle(o.ownerId, people).key,
                              percent: share(o.amount, c.total),
                              background: ownerStyle(o.ownerId, people).background,
                            }))
                          : undefined
                      }
                    />
                    {breakdown ? <span className="sr-only">{breakdown}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {categories.value.length > MAX_ROWS ? (
            <Link href={scopedHref("/laporan", scope)} className="self-start text-small text-accent underline">
              Lihat semua kategori di Laporan
            </Link>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

