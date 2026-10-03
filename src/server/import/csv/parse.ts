import type { CsvMapping, ParsedRow } from "../types";
import { parseCsvAmount, type AmountCell } from "./amount";
import { parseCsvDate, parseCsvTime } from "./dates";
import { decodeCsv } from "./encoding";
import { isBlankRow, tokenizeCsv } from "./tokenize";

export type SkipKind = "invalid" | "summary" | "pending";

export interface SkippedRow {
  /** Nomor baris di file (mulai 1), supaya pengguna bisa mencarinya di spreadsheet. */
  line: number;
  cells: string[];
  reason: string;
  kind: SkipKind;
}

export interface CsvParseResult {
  rows: ParsedRow[];
  skipped: SkippedRow[];
}

/** Pemetaan menyebut kolom yang tidak ada di file (templat lama, atau bank mengubah format ekspor). */
export class CsvMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvMappingError";
  }
}

// baris penutup tabel mutasi bank; dibaca sebagai ringkasan, bukan transaksi
const SUMMARY_RE = /^(saldo\s*(awal|akhir)|mutasi\s*(deb[ie]t|kredit)|total|jumlah|opening\s*balance|closing\s*balance|ending\s*balance|beginning\s*balance|sub\s*total)\b/i;
const PENDING_RE = /^pend(ing)?$/i;

/** Nama kolom dari baris header: sel kosong jadi "Kolom n", nama kembar diberi nomor. */
export function columnNames(header: readonly string[] | null, width: number): string[] {
  const seen = new Map<string, number>();
  return Array.from({ length: width }, (_, i) => {
    const base = header?.[i]?.replace(/\s+/g, " ").trim() || `Kolom ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function tableWidth(rows: readonly string[][]): number {
  return rows.reduce((max, r) => Math.max(max, r.length), 0);
}

export function decodeTable(bytes: Uint8Array, mapping: Pick<CsvMapping, "encoding" | "delimiter">): string[][] {
  return tokenizeCsv(decodeCsv(bytes, mapping.encoding), mapping.delimiter);
}

function indexOf(columns: readonly string[], name: string | null, required: boolean): number {
  if (name === null) return -1;
  const i = columns.indexOf(name);
  if (i === -1 && required) throw new CsvMappingError(`Kolom "${name}" tidak ada di file ini. Pilih ulang kolomnya.`);
  return i;
}

function amountOf(cell: AmountCell): bigint | null {
  return cell.kind === "value" ? (cell.value < 0n ? -cell.value : cell.value) : null;
}

type AmountResult = { amount: bigint } | { reason: string };

function signedAmount(cells: readonly string[], mapping: CsvMapping, idx: { debit: number; credit: number; amount: number }): AmountResult {
  const dec = mapping.decimalSeparator;
  if (idx.amount >= 0) {
    const cell = parseCsvAmount(cells[idx.amount] ?? "", dec);
    if (cell.kind === "empty") return { reason: "Nominal kosong" };
    if (cell.kind === "invalid") return { reason: `Nominal "${cells[idx.amount]}" tidak terbaca dengan pemisah desimal ${dec === "," ? "koma" : "titik"}` };
    if (cell.value === 0n) return { reason: "Nominal nol" };
    if (cell.marker) return { amount: cell.marker === "cr" ? amountOf(cell)! : -amountOf(cell)! };
    return { amount: mapping.amountPositiveIsIncome ? cell.value : -cell.value };
  }
  const debit = idx.debit >= 0 ? parseCsvAmount(cells[idx.debit] ?? "", dec) : ({ kind: "empty" } as const);
  const credit = idx.credit >= 0 ? parseCsvAmount(cells[idx.credit] ?? "", dec) : ({ kind: "empty" } as const);
  if (debit.kind === "invalid") return { reason: `Debit "${cells[idx.debit]}" tidak terbaca dengan pemisah desimal ${dec === "," ? "koma" : "titik"}` };
  if (credit.kind === "invalid") return { reason: `Kredit "${cells[idx.credit]}" tidak terbaca dengan pemisah desimal ${dec === "," ? "koma" : "titik"}` };
  const out = amountOf(debit) ?? 0n;
  const into = amountOf(credit) ?? 0n;
  if (out > 0n && into > 0n) return { reason: "Debit dan kredit sama-sama terisi" };
  if (out === 0n && into === 0n) return { reason: "Debit dan kredit kosong" };
  return { amount: into > 0n ? into : -out };
}

function balanceOf(cells: readonly string[], index: number, mapping: CsvMapping): bigint | null {
  if (index < 0) return null;
  const cell = parseCsvAmount(cells[index] ?? "", mapping.decimalSeparator);
  if (cell.kind !== "value") return null;
  return cell.marker === "db" && cell.value > 0n ? -cell.value : cell.value;
}

/**
 * Terapkan pemetaan ke tabel CSV. Setiap baris tak kosong setelah header jadi ParsedRow atau SkippedRow
 * beralasan; tidak ada baris yang dibuang diam-diam.
 */
export function parseCsvTable(table: readonly string[][], mapping: CsvMapping, referenceDate: string): CsvParseResult {
  const width = tableWidth(table);
  const header = mapping.headerRow >= 0 ? (table[mapping.headerRow] ?? null) : null;
  const columns = columnNames(header, width);
  const idx = {
    date: indexOf(columns, mapping.dateColumn, true),
    description: indexOf(columns, mapping.descriptionColumn, true),
    debit: indexOf(columns, mapping.debitColumn, true),
    credit: indexOf(columns, mapping.creditColumn, true),
    amount: indexOf(columns, mapping.amountColumn, true),
    balance: indexOf(columns, mapping.balanceColumn, false),
    time: indexOf(columns, mapping.timeColumn, false),
  };

  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];
  for (let r = mapping.headerRow + 1; r < table.length; r += 1) {
    const cells = table[r]!;
    if (isBlankRow(cells)) continue;
    const skip = (reason: string, kind: SkipKind = "invalid") => skipped.push({ line: r + 1, cells: [...cells], reason, kind });
    const dateCell = (cells[idx.date] ?? "").trim();
    const parsedDate = parseCsvDate(dateCell, mapping.dateFormat, referenceDate);
    if (!parsedDate) {
      const firstText = cells.find((c) => c.trim() !== "")?.trim() ?? "";
      if (PENDING_RE.test(dateCell)) skip("Transaksi masih tertunda di bank", "pending");
      else if (SUMMARY_RE.test(firstText) || SUMMARY_RE.test(dateCell)) skip("Baris ringkasan, bukan transaksi", "summary");
      else skip(dateCell ? `Tanggal "${dateCell}" tidak cocok dengan format ${mapping.dateFormat}` : "Tanggal kosong");
      continue;
    }
    const amount = signedAmount(cells, mapping, idx);
    if ("reason" in amount) {
      skip(amount.reason);
      continue;
    }
    const raw: Record<string, string> = {};
    columns.forEach((name, i) => {
      raw[name] = cells[i] ?? "";
    });
    rows.push({
      date: parsedDate.date,
      time: (idx.time >= 0 ? parseCsvTime(cells[idx.time] ?? "") : null) ?? parsedDate.time,
      description: (cells[idx.description] ?? "").replace(/\s+/g, " ").trim(),
      amount: amount.amount,
      balance: balanceOf(cells, idx.balance, mapping),
      raw,
    });
  }
  return { rows, skipped };
}

/** Baris yang dilewati karena bukan transaksi (ringkasan, tertunda) tidak perlu menahan templat otomatis. */
export function hasBlockingSkips(skipped: readonly SkippedRow[]): boolean {
  return skipped.some((s) => s.kind === "invalid");
}
