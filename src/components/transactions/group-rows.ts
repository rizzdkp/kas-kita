import { dateKey, formatRelativeDay } from "@/lib/dates";
import type { TransactionListRow } from "@/server/queries/transactions";

export const HEADER_HEIGHT = 48;
export const ROW_HEIGHT = 56;

export type ListItem =
  | { type: "header"; key: string; label: string; total: bigint | null }
  | { type: "row"; key: string; row: TransactionListRow };

/**
 * Baris dikelompokkan per hari WIB dengan total bersih hari itu (pemasukan − pengeluaran, transfer tidak dihitung).
 * Total hari terakhir disembunyikan selama halaman berikutnya belum dimuat karena bisa belum lengkap.
 */
export function groupByDay(rows: readonly TransactionListRow[], hasMore: boolean, now: Date = new Date()): ListItem[] {
  const items: ListItem[] = [];
  let currentKey = "";
  let headerIndex = -1;
  let total = 0n;
  const closeGroup = () => {
    if (headerIndex < 0) return;
    const header = items[headerIndex];
    if (header?.type === "header") header.total = total;
  };
  for (const row of rows) {
    const key = dateKey(row.occurredAt);
    if (key !== currentKey) {
      closeGroup();
      currentKey = key;
      total = 0n;
      headerIndex = items.length;
      items.push({ type: "header", key: `h-${key}`, label: formatRelativeDay(row.occurredAt, now), total: null });
    }
    if (row.flow === "income") total += row.amount;
    else if (row.flow === "expense") total -= row.amount;
    items.push({ type: "row", key: row.id, row });
  }
  if (!hasMore) closeGroup();
  return items;
}

export function itemSizes(items: readonly ListItem[]): number[] {
  return items.map((i) => (i.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT));
}

/** Gabungkan halaman pertama yang baru dari server dengan halaman lanjutan yang sudah dimuat. */
export function mergeFirstPage(
  fresh: { rows: TransactionListRow[]; nextCursor: string | null },
  loaded: { rows: TransactionListRow[]; nextCursor: string | null },
  loadedBeyondFirst: boolean,
): { rows: TransactionListRow[]; nextCursor: string | null } {
  if (!loadedBeyondFirst || fresh.nextCursor === null) return fresh;
  const last = fresh.rows[fresh.rows.length - 1];
  if (!last) return fresh;
  const ids = new Set(fresh.rows.map((r) => r.id));
  const older = loaded.rows.filter((r) => {
    if (ids.has(r.id)) return false;
    const t = r.occurredAt.getTime() - last.occurredAt.getTime();
    return t < 0 || (t === 0 && r.id < last.id);
  });
  return { rows: [...fresh.rows, ...older], nextCursor: loaded.nextCursor };
}
