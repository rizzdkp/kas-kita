import type { CsvMapping } from "../types";
import { detectReferenceDate } from "./detect";
import { inspectCsv } from "./inspect";
import { csvMappingSchema } from "./mapping-schema";
import { CsvMappingError, parseCsvTable, type SkippedRow } from "./parse";
import { isBlankRow } from "./tokenize";

export const PREVIEW_ROWS = 5;
// baris awal file untuk memilih baris header; judul bank jarang lebih dari belasan baris
const TOP_ROWS = 15;
const MAX_CELL = 80;
const SKIPPED_EXAMPLES = 5;

export type CsvLayout = Pick<CsvMapping, "encoding" | "delimiter" | "headerRow">;

/** Pemetaan yang sedang diisi di form: boleh belum lengkap, divalidasi di sini supaya pesan kurangnya tampil. */
export type MappingDraft = Record<string, unknown>;

export interface PreviewRow {
  date: string;
  time: string | null;
  description: string;
  amount: bigint;
}

export interface MappingPreview {
  layout: CsvLayout;
  columns: string[];
  /** Baris awal file apa adanya (dipotong), untuk memilih baris header. */
  topRows: string[][];
  /** Lima baris data pertama setelah header. */
  sample: { line: number; cells: string[] }[];
  suggestion: CsvMapping;
  /** Hasil pemetaan saat ini; null kalau pemetaan belum lengkap. */
  result: {
    rows: PreviewRow[];
    rowCount: number;
    skippedCount: number;
    blockingCount: number;
    skipped: SkippedRow[];
  } | null;
  /** Pesan kenapa pemetaan belum bisa diterapkan. */
  problem: string | null;
}

function clip(cells: readonly string[]): string[] {
  return cells.map((c) => (c.length > MAX_CELL ? `${c.slice(0, MAX_CELL - 1)}…` : c));
}

function skippedExamples(skipped: readonly SkippedRow[]): SkippedRow[] {
  const blocking = skipped.filter((s) => s.kind === "invalid");
  const other = skipped.filter((s) => s.kind !== "invalid");
  return [...blocking, ...other].slice(0, SKIPPED_EXAMPLES).map((s) => ({ ...s, cells: clip(s.cells) }));
}

/**
 * Pratinjau langkah pemetaan. `layout` (encoding, pemisah, baris header) dari form menimpa deteksi;
 * `draft` dipakai kalau kolomnya ada di layout ini, selain itu tebakan otomatis.
 */
export function buildMappingPreview(bytes: Uint8Array, today: string, layout?: Partial<CsvLayout>, draft?: MappingDraft | null): MappingPreview {
  const inspection = inspectCsv(bytes, today, layout);
  const { table, columns, suggestion } = inspection;
  const current: CsvLayout = { encoding: suggestion.encoding, delimiter: suggestion.delimiter, headerRow: suggestion.headerRow };
  // sama dengan saat diterapkan (upload.ts referenceDateFor) supaya pratinjau dan hasil tidak berbeda
  const referenceDate = detectReferenceDate(table, current.headerRow, today);
  const dataRows: { line: number; cells: string[] }[] = [];
  for (let r = current.headerRow + 1; r < table.length && dataRows.length < PREVIEW_ROWS; r += 1) {
    if (!isBlankRow(table[r]!)) dataRows.push({ line: r + 1, cells: clip(table[r]!) });
  }
  const base = {
    layout: current,
    columns,
    topRows: table.slice(0, TOP_ROWS).map(clip),
    sample: dataRows,
    suggestion,
  };

  const candidate = draft ? { ...draft, ...current } : suggestion;
  const parsed = csvMappingSchema.safeParse(candidate);
  if (!parsed.success) return { ...base, result: null, problem: parsed.error.issues[0]?.message ?? null };
  try {
    const result = parseCsvTable(table, parsed.data, referenceDate);
    return {
      ...base,
      result: {
        rows: result.rows.slice(0, PREVIEW_ROWS).map((r) => ({ date: r.date, time: r.time, description: r.description, amount: r.amount })),
        rowCount: result.rows.length,
        skippedCount: result.skipped.length,
        blockingCount: result.skipped.filter((s) => s.kind === "invalid").length,
        skipped: skippedExamples(result.skipped),
      },
      problem: result.rows.length === 0 ? "Tidak ada baris yang terbaca dengan pemetaan ini. Cek kolom tanggal, format tanggal, dan kolom nominal." : null,
    };
  } catch (e) {
    if (e instanceof CsvMappingError) return { ...base, result: null, problem: e.message };
    throw e;
  }
}
