"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Plus } from "lucide-react";
import type { Scope } from "@/lib/scope";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/components/ui/cn";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { FilterOptions } from "@/components/transactions/filter-controls";
import { EMPTY_QUERY, hasActiveFilters, queryKey, writeTransactionQuery, type TransactionQuery } from "@/components/transactions/filter-params";
import { TransactionDetailSheet, type DetailChange } from "@/components/transactions/transaction-detail-sheet";
import { TransactionFilters as FilterBar } from "@/components/transactions/transaction-filters";
import { TransactionFormSheet } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { updateTransactionAction } from "@/server/actions/transactions";
import type { TransactionFilters, TransactionListRow, TransactionPage } from "@/server/queries/transactions";
import { TransactionsEmpty } from "./transactions-empty";

type TransactionsViewProps = {
  scope: Scope;
  query: TransactionQuery;
  filters: TransactionFilters;
  initialPage: TransactionPage;
  formOptions: TransactionFormOptions;
  tags: Array<{ id: string; name: string }>;
  draftCount: number;
};

// label pendek di layar kecil supaya tiga pilihan muat tanpa menggulir
function viewOptions(draftCount: number) {
  return [
    { value: "all" as const, label: "Semua" },
    { value: "draft" as const, label: draftCount ? `Perlu dikonfirmasi (${draftCount})` : "Perlu dikonfirmasi" },
    { value: "deleted" as const, label: "Baru dihapus" },
  ];
}

type Patches = { key: string; removed: Set<string>; replaced: Map<string, TransactionListRow> };

export function TransactionsView({ scope, query, filters, initialPage, formOptions, tags, draftCount }: TransactionsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [formScope, setFormScope] = useState<Scope | null>(null);
  const people = formOptions.people;
  const listKey = queryKey(scope, query);
  const [patches, setPatches] = useState<Patches>(() => ({ key: listKey, removed: new Set(), replaced: new Map() }));
  const activePatches = patches.key === listKey ? patches : undefined;
  const openId = params.get("id");

  const filterOptions: FilterOptions = useMemo(() => {
    const owners = scope === "all" ? null : scope === "me" ? people.me.id : people.partner?.id;
    return {
      accounts: formOptions.accounts.filter((a) => owners === null || a.ownerId === owners || a.ownerId === null),
      categories: formOptions.categories,
      tags,
      people,
    };
  }, [formOptions, tags, people, scope]);

  const onQueryChange = useCallback(
    (patch: Partial<TransactionQuery>) => {
      const next = writeTransactionQuery(new URLSearchParams(window.location.search), { ...query, ...patch });
      next.delete("id");
      const search = next.toString();
      startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
    },
    [query, pathname, router],
  );

  // detail dibuka lewat history API supaya ?id= bisa ditautkan tanpa memuat ulang daftar dari server
  const setOpenId = useCallback((id: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (id) next.set("id", id);
    else next.delete("id");
    const search = next.toString();
    window.history.replaceState(null, "", search ? `${window.location.pathname}?${search}` : window.location.pathname);
  }, []);

  const patch = useCallback(
    (fn: (p: Patches) => void) => {
      setPatches((prev) => {
        const base = prev.key === listKey ? prev : { key: listKey, removed: new Set<string>(), replaced: new Map<string, TransactionListRow>() };
        const next = { key: listKey, removed: new Set(base.removed), replaced: new Map(base.replaced) };
        fn(next);
        return next;
      });
    },
    [listKey],
  );

  const onDetailChange = useCallback(
    (change: DetailChange) => {
      patch((p) => {
        if (change.type === "updated") {
          const leavesView = query.view === "draft" && change.row.status !== "draft";
          if (leavesView) p.removed.add(change.row.id);
          else p.replaced.set(change.row.id, change.row);
        } else if (change.type === "deleted") {
          if (query.view !== "deleted") p.removed.add(change.id);
        } else if (query.view === "deleted") {
          p.removed.add(change.id);
        } else {
          p.removed.delete(change.id);
        }
      });
    },
    [patch, query.view],
  );

  const confirmDraft = useCallback(
    async (row: TransactionListRow) => {
      const result = await updateTransactionAction({ id: row.id, version: row.version, patch: { status: "confirmed" } });
      if (!result.ok) {
        toast.show({ title: result.error });
        return false;
      }
      toast.show({ title: "Dikonfirmasi" });
      onDetailChange({ type: "updated", row: { ...row, status: "confirmed", version: result.data.version } });
      return true;
    },
    [toast, onDetailChange],
  );

  const filtered = hasActiveFilters(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden sm:block">
          <SegmentedControl label="Tampilan" value={query.view} onValueChange={(view) => onQueryChange({ view })} options={viewOptions(draftCount)} />
        </div>
        <div className="w-full sm:hidden">
          <SegmentedControl label="Tampilan" value={query.view} onValueChange={(view) => onQueryChange({ view })} options={viewOptions(0)} className="w-full" />
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setFormScope(scope)} className="max-sm:hidden">
          Tambah transaksi
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <FilterBar query={query} onChange={onQueryChange} options={filterOptions} />
        </div>
        <IconButton icon={Plus} label="Tambah transaksi" variant="secondary" onClick={() => setFormScope(scope)} className="sm:hidden" />
      </div>

      <section aria-label="Daftar transaksi" aria-busy={pending || undefined} className={cn("rounded-card border border-border bg-surface px-1 pb-2 transition-opacity duration-(--dur-fast) sm:px-2", pending && "opacity-60")}>
        <TransactionList
          key={listKey}
          initialPage={initialPage}
          filters={filters}
          people={people}
          patches={activePatches}
          onOpen={(row) => setOpenId(row.id)}
          renderTrailing={
            query.view === "draft"
              ? (row) => (
                  <Button icon={Check} onClick={() => void confirmDraft(row)} className="shrink-0 max-sm:px-3" aria-label={`Konfirmasi ${row.note ?? row.categoryName ?? "transaksi"}`}>
                    <span className="max-sm:hidden">Konfirmasi</span>
                  </Button>
                )
              : undefined
          }
          empty={
            <TransactionsEmpty
              scope={scope}
              view={query.view}
              filtered={filtered}
              partnerName={people.partner?.name ?? null}
              onClearFilters={() => onQueryChange({ ...EMPTY_QUERY, view: query.view })}
              onRecordForPartner={() => setFormScope("partner")}
            />
          }
        />
      </section>

      <TransactionFormSheet
        open={formScope !== null}
        onOpenChange={(open) => (!open ? setFormScope(null) : undefined)}
        mode="create"
        scope={formScope ?? scope}
        options={formScope === scope ? formOptions : undefined}
      />

      <TransactionDetailSheet
        id={openId}
        onClose={() => setOpenId(null)}
        people={people}
        scope={scope}
        formOptions={formOptions}
        onChange={onDetailChange}
        onConfirmDraft={confirmDraft}
      />
    </div>
  );
}
