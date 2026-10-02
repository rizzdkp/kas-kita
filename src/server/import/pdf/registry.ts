import type { ParsedRow } from "../types";
import { contohBankParser } from "./parsers/contoh-bank";
import type { StatementParser } from "./types";

// parser per institusi; slug sama dengan institutions.slug. Tambah parser baru di sini (docs/decisions/0008).
export const statementParsers: ReadonlyArray<StatementParser> = [contohBankParser];

export type ParseOutcome =
  | { kind: "parsed"; slug: string; rows: ParsedRow[] }
  | { kind: "unrecognized" }
  | { kind: "failed"; slug: string };

function logParserError(slug: string, stage: "canParse" | "parse", e: unknown): void {
  // hanya slug dan jenis error: pesan error parser bisa memuat potongan teks mutasi
  const errorName = e instanceof Error ? e.name : typeof e;
  console.error(JSON.stringify({ level: "error", msg: "pdf_parser_failed", slug, stage, errorName }));
}

/**
 * Cari parser yang mengenali halaman pertama lalu jalankan. Setiap parser dibungkus try/catch
 * sendiri supaya satu parser rusak tidak menggagalkan deteksi atau impor institusi lain (F-IN-5 AC4).
 */
export function parseStatement(pages: string[], parsers: ReadonlyArray<StatementParser> = statementParsers): ParseOutcome {
  const first = pages[0] ?? "";
  for (const parser of parsers) {
    let match = false;
    try {
      match = parser.canParse(first);
    } catch (e) {
      logParserError(parser.slug, "canParse", e);
      continue;
    }
    if (!match) continue;
    try {
      const rows = parser.parse(pages);
      return rows.length > 0 ? { kind: "parsed", slug: parser.slug, rows } : { kind: "failed", slug: parser.slug };
    } catch (e) {
      logParserError(parser.slug, "parse", e);
      return { kind: "failed", slug: parser.slug };
    }
  }
  return { kind: "unrecognized" };
}
