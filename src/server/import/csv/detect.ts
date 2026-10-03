import type { CsvMapping } from "../types";
import { detectDecimalSeparator, looksLikeAmount } from "./amount";
import { datesInText, detectDateFormat, looksLikeDate } from "./dates";
import { isBlankRow, tokenizeCsv, type CsvDelimiter } from "./tokenize";

const DELIMITERS: readonly CsvDelimiter[] = ["\t", ";", ","];
const SAMPLE_ROWS = 60;
const HEADER_SCAN_ROWS = 40;

function mode(values: readonly number[]): { value: number; count: number } {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = { value: 0, count: 0 };
  for (const [value, count] of counts) {
    if (count > best.count || (count === best.count && value > best.value)) best = { value, count };
  }
  return best;
}

/**
 * Pemisah dengan jumlah kolom paling konsisten. Koma kalah seri dari titik koma dan tab karena koma juga
 * muncul di nominal gaya Indonesia ("1.250.000,00").
 */
export function detectDelimiter(text: string): CsvDelimiter {
  let best: { delimiter: CsvDelimiter; score: number } = { delimiter: ",", score: -1 };
  for (const delimiter of DELIMITERS) {
    const rows = tokenizeCsv(text, delimiter, SAMPLE_ROWS).filter((r) => !isBlankRow(r));
    const widths = rows.map((r) => r.length).filter((w) => w > 1);
    if (widths.length === 0) continue;
    const m = mode(widths);
    const score = m.count * Math.min(m.value, 8);
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

function filled(row: readonly string[]): string[] {
  return row.map((c) => c.trim()).filter(Boolean);
}

/**
 * Baris header = baris teks pertama yang diikuti baris berisi tanggal. Mutasi bank sering diawali baris judul
 * (nama nasabah, nomor rekening, periode) dengan lebar berbeda dari tabel. -1 kalau tabel tanpa header.
 */
export function detectHeaderRow(rows: readonly string[][], referenceDate: string): number {
  const scan = rows.slice(0, HEADER_SCAN_ROWS);
  const width = mode(scan.map((r) => filled(r).length).filter((w) => w > 1)).value;
  const isData = (row: readonly string[] | undefined) => Boolean(row && row.some((c) => looksLikeDate(c, referenceDate)) && row.some((c) => looksLikeAmount(c)));
  for (let i = 0; i < scan.length; i += 1) {
    const cells = filled(scan[i]!);
    if (cells.length < Math.max(2, Math.ceil(width * 0.6))) continue;
    if (cells.some((c) => looksLikeDate(c, referenceDate) || /^[-−(]?[\d.,]+\)?$/.test(c))) {
      if (isData(scan[i])) return i - 1 >= 0 && filled(scan[i - 1]!).length >= 2 ? i - 1 : -1;
      continue;
    }
    const next = scan.slice(i + 1, i + 4).filter((r) => !isBlankRow(r));
    if (next.some((r) => isData(r))) return i;
  }
  return 0;
}

/** Tanggal acuan untuk tanggal tanpa tahun: tanggal terakhir di baris judul (periode mutasi), atau hari ini. */
export function detectReferenceDate(rows: readonly string[][], headerRow: number, today: string): string {
  const preamble = rows.slice(0, Math.max(0, headerRow)).flat().join(" ");
  const dates = datesInText(preamble).filter((d) => d <= today);
  return dates.length > 0 ? dates.sort().at(-1)! : today;
}

const PATTERNS = {
  date: /tanggal|tgl|date|posting/i,
  time: /^(jam|waktu|time)$/i,
  description: /keterangan|deskripsi|description|uraian|remark|detail|narasi|berita|transaksi|transaction/i,
  debit: /deb[ie]t|keluar|withdraw|pengeluaran|^db$|^dr$/i,
  credit: /kredit|credit|masuk|deposit|pemasukan|^cr$/i,
  amount: /jumlah|nominal|amount|mutasi|nilai/i,
  balance: /saldo|balance/i,
} as const;

function valuesOf(rows: readonly string[][], index: number): string[] {
  return rows.map((r) => (r[index] ?? "").trim()).filter(Boolean);
}

/** Tebakan awal pemetaan dari nama kolom dan isi sel; pengguna selalu bisa mengubahnya di langkah pemetaan. */
export function suggestMapping(
  columns: readonly string[],
  dataRows: readonly string[][],
  base: Pick<CsvMapping, "encoding" | "delimiter" | "headerRow">,
  referenceDate: string,
): CsvMapping {
  const used = new Set<number>();
  const pick = (pattern: RegExp, accept: (values: string[]) => boolean = () => true): number => {
    const i = columns.findIndex((name, idx) => !used.has(idx) && pattern.test(name) && accept(valuesOf(dataRows, idx)));
    if (i >= 0) used.add(i);
    return i;
  };
  const dateLike = (values: string[]) => values.length === 0 || values.filter((v) => looksLikeDate(v, referenceDate)).length / values.length >= 0.5;
  const amountLike = (values: string[]) => values.length === 0 || values.filter(looksLikeAmount).length / values.length >= 0.5;

  let date = pick(PATTERNS.date, dateLike);
  if (date < 0) {
    date = columns.findIndex((_, idx) => !used.has(idx) && valuesOf(dataRows, idx).length > 0 && dateLike(valuesOf(dataRows, idx)));
    if (date >= 0) used.add(date);
  }
  const time = pick(PATTERNS.time);
  const balance = pick(PATTERNS.balance, amountLike);
  const debit = pick(PATTERNS.debit, amountLike);
  const credit = pick(PATTERNS.credit, amountLike);
  const split = debit >= 0 && credit >= 0;
  if (!split) {
    if (debit >= 0) used.delete(debit);
    if (credit >= 0) used.delete(credit);
  }
  const amount = split ? -1 : pick(PATTERNS.amount, amountLike);
  const description = pick(PATTERNS.description);

  const amountCols = split ? [debit, credit] : [amount];
  const amountValues = amountCols.filter((i) => i >= 0).flatMap((i) => valuesOf(dataRows, i));
  const name = (i: number) => (i >= 0 ? columns[i]! : null);

  return {
    ...base,
    dateColumn: name(date) ?? "",
    dateFormat: (date >= 0 ? detectDateFormat(valuesOf(dataRows, date), referenceDate) : null) ?? "DD/MM/YYYY",
    descriptionColumn: name(description) ?? "",
    debitColumn: split ? name(debit) : null,
    creditColumn: split ? name(credit) : null,
    amountColumn: split ? null : name(amount),
    amountPositiveIsIncome: true,
    decimalSeparator: detectDecimalSeparator(amountValues),
    balanceColumn: name(balance),
    timeColumn: name(time),
  };
}
