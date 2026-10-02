import type { ParsedRow } from "../types";

/** Kontrak parser e-statement per institusi (ARCHITECTURE.md bagian 6). */
export interface StatementParser {
  /** Sama dengan institutions.slug. */
  slug: string;
  /** Deteksi dari teks halaman pertama. */
  canParse(text: string): boolean;
  /** Tanggal, deskripsi, nominal bertanda, saldo opsional. Lempar error bila format tidak sesuai harapan. */
  parse(pages: string[]): ParsedRow[];
}
