import type { CsvMapping } from "../types";

export type DecimalSeparator = CsvMapping["decimalSeparator"];

export type AmountCell =
  | { kind: "empty" }
  | { kind: "invalid" }
  /** `value` sudah bertanda dari "-", "(…)", atau tanda minus di belakang; `marker` dari akhiran CR/DB. */
  | { kind: "value"; value: bigint; marker: "cr" | "db" | null };

// akhiran arah di kolom mutasi: CR/K = kredit (masuk), DB/DR/D = debit (keluar)
const MARKER_RE = /(?<=[\d)\s])(CR|DB|DR|D|K|C)\.?$/i;
const MARKER_PREFIX_RE = /^(CR|DB|DR)\s+/i;

function markerOf(code: string): "cr" | "db" {
  return /^(CR|K|C)$/i.test(code) ? "cr" : "db";
}

function roundHalfUp(intDigits: string, frac: string): bigint {
  const whole = BigInt(intDigits || "0");
  if (!frac) return whole;
  return frac.charCodeAt(0) >= 53 ? whole + 1n : whole;
}

// pemisah ribuan wajib kelompok 3 digit; "1250000.00" dengan pemisah desimal koma ditolak, bukan dibaca 100x lipat
function splitDigits(s: string, decimal: DecimalSeparator): { int: string; frac: string } | null {
  const group = decimal === "," ? "\\." : ",";
  const dec = decimal === "," ? "," : "\\.";
  const m = new RegExp(`^(\\d{1,3}(?:${group}\\d{3})+|\\d+)(?:${dec}(\\d+))?$`).exec(s);
  if (!m) return null;
  return { int: m[1]!.replace(/[.,]/g, ""), frac: m[2] ?? "" };
}

/** Baca sel nominal mutasi menjadi rupiah bulat bertanda sesuai pemisah desimal yang dipilih. */
export function parseCsvAmount(input: string, decimal: DecimalSeparator): AmountCell {
  let s = input.replace(/[\u00a0\u202f]/g, " ").trim();
  if (s === "" || s === "-" || s === "−") return { kind: "empty" };

  let marker: "cr" | "db" | null = null;
  const suffix = MARKER_RE.exec(s);
  if (suffix) {
    marker = markerOf(suffix[1]!);
    s = s.slice(0, suffix.index).trim();
  } else {
    const prefix = MARKER_PREFIX_RE.exec(s);
    if (prefix) {
      marker = markerOf(prefix[1]!);
      s = s.slice(prefix[0].length).trim();
    }
  }

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^(Rp\.?|IDR)\s*/i, "");
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (/^\+/.test(s)) {
    s = s.slice(1).trim();
  } else if (/[-−]$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(/^(Rp\.?|IDR)\s*/i, "").replace(/\s+/g, "");

  const digits = splitDigits(s, decimal);
  if (!digits) return { kind: "invalid" };
  const value = roundHalfUp(digits.int, digits.frac);
  return { kind: "value", value: negative ? -value : value, marker };
}

/**
 * Tebak pemisah desimal dari contoh sel. "1.250.000,00" dan "25.000" (ribuan rupiah) memilih koma;
 * "1,250,000.00" dan "25000.50" memilih titik.
 */
export function detectDecimalSeparator(values: readonly string[]): DecimalSeparator {
  let comma = 0;
  let dot = 0;
  for (const raw of values.slice(0, 500)) {
    const v = raw.replace(MARKER_RE, "").replace(/[^\d.,]/g, "");
    if (!v) continue;
    if (/\.\d{3}(,\d+)?$/.test(v) && /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) comma += 1;
    else if (/,\d{1,2}$/.test(v)) comma += 1;
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) dot += 1;
    else if (/\.\d{1,2}$/.test(v)) dot += 1;
  }
  return dot > comma ? "." : ",";
}

export function looksLikeAmount(value: string): boolean {
  const v = value.trim();
  if (!/\d/.test(v)) return false;
  return parseCsvAmount(v, ",").kind === "value" || parseCsvAmount(v, ".").kind === "value";
}
