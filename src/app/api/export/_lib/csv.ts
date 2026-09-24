import { dateKey, formatTime } from "@/lib/dates";
import type { TransactionListRow } from "@/server/queries/transactions";

export const CSV_HEADER = [
  "Tanggal",
  "Waktu",
  "Jenis",
  "Nominal",
  "Akun",
  "Akun tujuan",
  "Kategori",
  "Catatan",
  "Diisi oleh",
  "Tag",
  "Status",
] as const;

const KIND_TEXT = { income: "Pemasukan", expense: "Pengeluaran", transfer: "Transfer" } as const;
const STATUS_TEXT = { confirmed: "Terkonfirmasi", draft: "Perlu dikonfirmasi" } as const;

// sel yang diawali = + - @ dieksekusi sebagai rumus oleh spreadsheet (CSV injection)
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint" || typeof value === "number") return value.toString();
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvLine(cells: Array<string | number | bigint | null | undefined>): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** Satu baris transaksi; nominal angka bulat tanpa pemisah ribuan, tanggal dan waktu WIB. */
export function transactionCsvRow(r: TransactionListRow): string {
  const category = r.parentCategoryName && r.categoryName ? `${r.parentCategoryName} / ${r.categoryName}` : r.categoryName;
  return csvLine([
    dateKey(r.occurredAt),
    // titik dua, bukan format tampilan "09.12", supaya spreadsheet membacanya sebagai waktu
    formatTime(r.occurredAt).replace(".", ":"),
    KIND_TEXT[r.kind],
    r.amount,
    r.accountName,
    r.toAccountName,
    category,
    r.note,
    r.createdByName,
    r.tags.map((t) => t.name).join("; "),
    STATUS_TEXT[r.status],
  ]);
}

export function csvFilename(from?: string, to?: string): string {
  if (from && to) return `kas-kita-transaksi-${from}-sampai-${to}.csv`;
  if (from) return `kas-kita-transaksi-sejak-${from}.csv`;
  return "kas-kita-transaksi.csv";
}
