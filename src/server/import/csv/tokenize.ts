import type { CsvMapping } from "../types";

export type CsvDelimiter = CsvMapping["delimiter"];

/**
 * Parser CSV RFC 4180: field ber-kutip boleh memuat pemisah, baris baru, dan "" sebagai kutip.
 * Longgar untuk ekspor bank yang tidak rapi: kutip di tengah field tanpa kutip dibaca apa adanya.
 */
export function tokenizeCsv(text: string, delimiter: CsvDelimiter, maxRows = Number.POSITIVE_INFINITY): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let fieldStart = true;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = "";
    fieldStart = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < n; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && fieldStart) {
      quoted = true;
      fieldStart = false;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
      if (rows.length >= maxRows) return rows;
    } else {
      field += ch;
      fieldStart = false;
    }
  }
  if (field !== "" || !fieldStart || row.length > 0) endRow();
  return rows;
}

export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}
