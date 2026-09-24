"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Amount } from "@/components/money/amount";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listTransactionsAction } from "@/server/actions/transactions";
import type { TransactionFilters, TransactionListRow, TransactionPage } from "@/server/queries/transactions";
import { groupByDay, itemSizes, mergeFirstPage, ROW_HEIGHT } from "./group-rows";
import { TransactionRow } from "./transaction-row";
import type { People } from "./types";
import { useWindowVirtualizer } from "./use-window-virtualizer";

const PAGE_SIZE = 100;
// mulai memuat halaman berikutnya saat sisa item di bawah layar tinggal sekian
const LOAD_AHEAD_ITEMS = 30;

type TransactionListProps = {
  initialPage: TransactionPage;
  filters: TransactionFilters;
  people: People;
  onOpen: (row: TransactionListRow) => void;
  /** Aksi di kanan baris, misalnya Konfirmasi untuk draf. */
  renderTrailing?: (row: TransactionListRow) => ReactNode;
  /** Ditampilkan kalau halaman pertama kosong. */
  empty: ReactNode;
  /** Perubahan lokal (hapus, ubah) tanpa menunggu muat ulang. */
  patches?: { removed: ReadonlySet<string>; replaced: ReadonlyMap<string, TransactionListRow> };
};

export function TransactionList({ initialPage, filters, people, onOpen, renderTrailing, empty, patches }: TransactionListProps) {
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedBeyondFirst = useRef(false);
  const lastInitial = useRef(initialPage);

  // halaman pertama baru dari server (setelah simpan/hapus) digabung tanpa membuang halaman lanjutan
  useEffect(() => {
    if (lastInitial.current === initialPage) return;
    lastInitial.current = initialPage;
    setPage((loaded) => mergeFirstPage(initialPage, loaded, loadedBeyondFirst.current));
  }, [initialPage]);

  const rows = useMemo(() => {
    if (!patches) return page.rows;
    return page.rows.filter((r) => !patches.removed.has(r.id)).map((r) => patches.replaced.get(r.id) ?? r);
  }, [page.rows, patches]);

  const hasMore = page.nextCursor !== null;
  const items = useMemo(() => groupByDay(rows, hasMore), [rows, hasMore]);
  const sizes = useMemo(() => {
    const s = itemSizes(items);
    return hasMore || error ? [...s, ROW_HEIGHT * 2] : s;
  }, [items, hasMore, error]);
  const virtual = useWindowVirtualizer(sizes);

  const loadMore = useCallback(async () => {
    if (!page.nextCursor || loading) return;
    setLoading(true);
    setError(null);
    const result = await listTransactionsAction({ filters, cursor: page.nextCursor, limit: PAGE_SIZE });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    loadedBeyondFirst.current = true;
    setPage((prev) => {
      const seen = new Set(prev.rows.map((r) => r.id));
      return { rows: [...prev.rows, ...result.data.rows.filter((r) => !seen.has(r.id))], nextCursor: result.data.nextCursor };
    });
  }, [filters, page.nextCursor, loading]);

  const nearEnd = virtual.lastVisibleIndex >= items.length - LOAD_AHEAD_ITEMS;
  useEffect(() => {
    if (nearEnd && hasMore && !loading && !error) void loadMore();
  }, [nearEnd, hasMore, loading, error, loadMore]);

  if (rows.length === 0 && !hasMore) return <>{empty}</>;

  return (
    <div ref={virtual.containerRef} className="relative" style={{ height: virtual.totalSize }} aria-busy={loading || undefined}>
      {virtual.items.map((v) => {
        const item = items[v.index];
        const style = { transform: `translateY(${v.start}px)`, height: v.size };
        if (!item) {
          return (
            <div key="footer" className="absolute inset-x-0 top-0 flex items-center gap-3 px-2" style={style}>
              {error ? (
                <p className="flex flex-wrap items-center gap-3 text-small text-secondary">
                  <span>{error}</span>
                  <Button onClick={() => void loadMore()}>Coba lagi</Button>
                </p>
              ) : (
                <span role="status" className="flex w-full items-center gap-3">
                  <span className="sr-only">Memuat transaksi berikutnya</span>
                  <Skeleton className="size-8 rounded-pill" />
                  <Skeleton className="h-3 w-2/5" />
                </span>
              )}
            </div>
          );
        }
        if (item.type === "header") {
          return (
            <div key={item.key} className="absolute inset-x-0 top-0 flex items-end justify-between gap-3 px-2 pb-2" style={style}>
              <h2 className="text-small font-medium text-primary">{item.label}</h2>
              {item.total !== null && item.total !== 0n ? (
                <span className="text-small text-secondary">
                  <span className="sr-only">Total </span>
                  <Amount value={item.total} sign="always" />
                </span>
              ) : null}
            </div>
          );
        }
        return (
          <div key={item.key} className="absolute inset-x-0 top-0" style={style}>
            <TransactionRow row={item.row} people={people} onOpen={onOpen} trailing={renderTrailing?.(item.row)} />
          </div>
        );
      })}
    </div>
  );
}
