import type { CsvMapping } from "../types";
import { detectDelimiter, detectHeaderRow, detectReferenceDate, suggestMapping } from "./detect";
import { decodeCsv, detectEncoding } from "./encoding";
import { columnNames, tableWidth } from "./parse";
import { isBlankRow, tokenizeCsv } from "./tokenize";

export interface CsvInspection {
  table: string[][];
  columns: string[];
  referenceDate: string;
  suggestion: CsvMapping;
}

type Layout = Pick<CsvMapping, "encoding" | "delimiter"> & { headerRow?: number };

/**
 * Deteksi encoding, pemisah, dan baris header, lalu tebak pemetaan. `layout` dari form pemetaan
 * menimpa hasil deteksi (misalnya pengguna memilih baris header lain).
 */
export function inspectCsv(bytes: Uint8Array, today: string, layout?: Partial<Layout>): CsvInspection {
  const encoding = layout?.encoding ?? detectEncoding(bytes);
  const text = decodeCsv(bytes, encoding);
  const delimiter = layout?.delimiter ?? detectDelimiter(text);
  const table = tokenizeCsv(text, delimiter);
  const provisional = detectHeaderRow(table, today);
  const referenceDate = detectReferenceDate(table, provisional, today);
  const headerRow = layout?.headerRow ?? detectHeaderRow(table, referenceDate);
  const columns = columnNames(headerRow >= 0 ? (table[headerRow] ?? null) : null, tableWidth(table));
  const dataRows = table.slice(headerRow + 1).filter((r) => !isBlankRow(r)).slice(0, 200);
  const suggestion = suggestMapping(columns, dataRows, { encoding, delimiter, headerRow }, referenceDate);
  return { table, columns, referenceDate, suggestion };
}

/** Kolom yang dipakai templat harus ada di file; kalau tidak, pengguna memetakan ulang. */
export function templateFits(mapping: CsvMapping, columns: readonly string[]): boolean {
  const needed = [mapping.dateColumn, mapping.descriptionColumn, mapping.debitColumn, mapping.creditColumn, mapping.amountColumn];
  return needed.every((c) => c === null || columns.includes(c));
}
