import type { CsvMapping } from "@/server/import/types";

export const NONE = "__kosong";

export const DATE_FORMAT_OPTIONS: { value: CsvMapping["dateFormat"]; label: string }[] = [
  { value: "DD/MM/YYYY", label: "31/12/2026 (hari/bulan/tahun)" },
  { value: "DD-MM-YYYY", label: "31-12-2026 (hari-bulan-tahun)" },
  { value: "YYYY-MM-DD", label: "2026-12-31 (tahun-bulan-hari)" },
  { value: "DD MMM YYYY", label: "31 Des 2026 (nama bulan)" },
  { value: "MM/DD/YYYY", label: "12/31/2026 (bulan/hari/tahun)" },
];

export const DECIMAL_OPTIONS: { value: CsvMapping["decimalSeparator"]; label: string }[] = [
  { value: ",", label: "Koma: 1.250.000,00" },
  { value: ".", label: "Titik: 1,250,000.00" },
];

export const DELIMITER_OPTIONS: { value: CsvMapping["delimiter"]; label: string }[] = [
  { value: ",", label: "Koma" },
  { value: ";", label: "Titik koma" },
  { value: "\t", label: "Tab" },
];

export const ENCODING_OPTIONS: { value: CsvMapping["encoding"]; label: string }[] = [
  { value: "utf-8", label: "UTF-8" },
  { value: "windows-1252", label: "Windows-1252 (Excel lama)" },
];

export type AmountMode = "split" | "single";

export const AMOUNT_MODE_OPTIONS: { value: AmountMode; label: string }[] = [
  { value: "split", label: "Debit dan kredit" },
  { value: "single", label: "Satu kolom" },
];

export const DIRECTION_OPTIONS: { value: "in" | "out"; label: string }[] = [
  { value: "in", label: "Positif berarti masuk" },
  { value: "out", label: "Positif berarti keluar" },
];

/** Label kolom di tabel pratinjau: kolom mana yang dipakai untuk apa. */
export function roleOf(mapping: CsvMapping, column: string): string | null {
  if (mapping.dateColumn === column) return "Tanggal";
  if (mapping.descriptionColumn === column) return "Deskripsi";
  if (mapping.amountColumn === column) return "Nominal";
  if (mapping.debitColumn === column) return "Debit";
  if (mapping.creditColumn === column) return "Kredit";
  if (mapping.balanceColumn === column) return "Saldo";
  if (mapping.timeColumn === column) return "Jam";
  return null;
}

export function headerRowLabel(index: number, cells: readonly string[]): string {
  const text = cells.map((c) => c.trim()).filter(Boolean).join(", ");
  const short = text.length > 60 ? `${text.slice(0, 59)}…` : text;
  return `Baris ${index + 1}: ${short || "kosong"}`;
}
