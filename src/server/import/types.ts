// kontrak pipeline impor (ARCHITECTURE.md bagian 6); dipakai parser CSV, parser PDF, dedupe, dan layar tinjau

/** Satu baris mutasi setelah dinormalisasi parser mana pun. */
export interface ParsedRow {
  /** Tanggal transaksi WIB, "YYYY-MM-DD". */
  date: string;
  /** Jam WIB "HH:mm" bila mutasi menyediakannya. */
  time: string | null;
  description: string;
  /** Rupiah bertanda: positif = uang masuk ke akun, negatif = uang keluar. Tidak pernah 0. */
  amount: bigint;
  /** Saldo setelah baris ini bila mutasi menyediakannya (untuk verifikasi saldo berjalan). */
  balance: bigint | null;
  /** Nilai sel/teks asli, disimpan di import_rows.raw. */
  raw: Record<string, string>;
}

export type ImportFormat = "csv" | "pdf" | "ai_pdf";

export type DedupeGroup = "new" | "possible_duplicate" | "exact_duplicate";

/** Pemetaan kolom CSV yang disimpan sebagai templat per institusi (import_templates.mapping). */
export interface CsvMapping {
  encoding: "utf-8" | "windows-1252";
  delimiter: "," | ";" | "\t";
  /** Indeks baris header (0-based); baris data mulai setelahnya. */
  headerRow: number;
  dateColumn: string;
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD" | "DD MMM YYYY" | "DD-MM-YYYY" | "MM/DD/YYYY";
  descriptionColumn: string;
  /** Salah satu: debit+credit, atau amount bertanda. */
  debitColumn: string | null;
  creditColumn: string | null;
  amountColumn: string | null;
  /** Untuk kolom nominal bertanda: apakah nilai positif berarti uang masuk. */
  amountPositiveIsIncome: boolean;
  decimalSeparator: "," | ".";
  balanceColumn: string | null;
  timeColumn: string | null;
}
