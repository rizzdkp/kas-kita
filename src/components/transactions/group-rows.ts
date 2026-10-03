import { MONTHS_SHORT } from "@/lib/dates";
import type { TransactionListRow } from "@/server/queries/transactions";

export const HEADER_HEIGHT = 48;
export const ROW_HEIGHT = 56;

// WIB tetap UTC+7 tanpa DST; hitung kunci hari tanpa TZDate supaya 20.000 baris tetap cepat
const WIB_OFFSET_MS = 7 * 3_600_000;
function wibDayKey(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Sama dengan formatRelativeDay, tapi dari kunci hari yang sudah ada. */
function dayLabel(key: string, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return "Hari ini";
  if (key === yesterdayKey) return "Kemarin";
  const [y, m, d] = key.split("-");
  const base = `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]}`;
  return y === todayKey.slice(0, 4) ? base : `${base} ${y}`;
}

export type ListItem =
  | { type: "header"; key: string; label: string; total: bigint | null }
  | { type: "row"; key: string; row: TransactionListRow };

/**
 * Baris dikelompokkan per hari WIB dengan total bersih hari itu (pemasukan − pengeluaran, transfer tidak dihitung).
 * Total hari terakhir disembunyikan selama halaman berikutnya belum dimuat karena bisa belum lengkap.
 */
export function groupByDay(rows: readonly TransactionListRow[], hasMore: boolean, now: Date = new Date()): ListItem[] {
  const items: ListItem[] = [];
  const todayKey = wibDayKey(now);
  const yesterdayKey = wibDayKey(new Date(now.getTime() - 86_400_000));
  let currentKey = "";
  let headerIndex = -1;
  let total = 0n;
  const closeGroup = () => {
    if (headerIndex < 0) return;
    const header = items[headerIndex];
    if (header?.type === "header") header.total = total;
  };
  for (const row of rows) {
    const key = wibDayKey(row.occurredAt);
    if (key !== currentKey) {
      closeGroup();
      currentKey = key;
      total = 0n;
      headerIndex = items.length;
      items.push({ type: "header", key: `h-${key}`, label: dayLabel(key, todayKey, yesterdayKey), total: null });
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

function newerFirst(a: TransactionListRow, b: TransactionListRow): number {
  const t = b.occurredAt.getTime() - a.occurredAt.getTime();
  return t !== 0 ? t : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Sisipkan baris yang belum ada sesuai urutan daftar; baris di luar rentang yang sudah dimuat dibiarkan ke halaman berikutnya. */
export function insertRows(
  rows: TransactionListRow[],
  extra: ReadonlyMap<string, TransactionListRow> | undefined,
  hasMore: boolean,
): TransactionListRow[] {
  if (!extra || extra.size === 0) return rows;
  const ids = new Set(rows.map((r) => r.id));
  const last = rows[rows.length - 1];
  const missing = [...extra.values()].filter((r) => !ids.has(r.id) && !(hasMore && last && newerFirst(r, last) > 0));
  if (missing.length === 0) return rows;
  return [...rows, ...missing].sort(newerFirst);
}
