import type { CsvMapping } from "../types";

export type CsvDateFormat = CsvMapping["dateFormat"];

export const CSV_DATE_FORMATS: readonly CsvDateFormat[] = ["DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY", "DD-MM-YYYY", "MM/DD/YYYY"];

// singkatan dan nama lengkap bulan Indonesia dan Inggris; "agt"/"ags" dipakai beberapa bank lokal
const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, pebruari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, ags: 8, agus: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, nopember: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

export interface CsvDateValue {
  date: string;
  time: string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function fullYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

function build(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2999) return null;
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Jam "HH:mm", "HH.mm", atau "HH:mm:ss" menjadi "HH:mm". */
export function parseCsvTime(value: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${pad2(h)}:${pad2(min)}` : null;
}

/** Tanggal tanpa tahun (mutasi BCA "01/09") memakai tahun tanggal acuan, mundur setahun kalau jadi lewat acuan. */
function withInferredYear(month: number, day: number, referenceDate: string): string | null {
  const refYear = Number(referenceDate.slice(0, 4));
  const candidate = build(refYear, month, day);
  if (candidate && candidate <= referenceDate) return candidate;
  return build(refYear - 1, month, day);
}

function splitTime(value: string): { datePart: string; time: string | null } | null {
  const m = /^(.*?)(?:[ T]+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?))?$/.exec(value);
  if (!m) return null;
  const time = m[2] ? parseCsvTime(m[2]) : null;
  if (m[2] && !time) return null;
  return { datePart: (m[1] ?? "").trim(), time };
}

/**
 * Baca satu sel tanggal dengan format tertentu. `referenceDate` ("YYYY-MM-DD") dipakai untuk tanggal
 * tanpa tahun. Sel boleh diikuti jam ("01/09/2026 14:05").
 */
export function parseCsvDate(value: string, format: CsvDateFormat, referenceDate: string): CsvDateValue | null {
  const parts = splitTime(value.trim().replace(/^'/, ""));
  if (!parts || !parts.datePart) return null;
  const s = parts.datePart;
  let date: string | null = null;
  switch (format) {
    case "DD/MM/YYYY":
    case "DD-MM-YYYY":
    case "MM/DD/YYYY": {
      const sep = format === "DD-MM-YYYY" ? "-" : "/";
      const re = new RegExp(`^(\\d{1,2})\\${sep}(\\d{1,2})(?:\\${sep}(\\d{4}|\\d{2}))?$`);
      const m = re.exec(s);
      if (!m) return null;
      const [a, b] = [Number(m[1]), Number(m[2])];
      const [day, month] = format === "MM/DD/YYYY" ? [b, a] : [a, b];
      date = m[3] ? build(fullYear(m[3]), month, day) : withInferredYear(month, day, referenceDate);
      break;
    }
    case "YYYY-MM-DD": {
      const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
      if (!m) return null;
      date = build(Number(m[1]), Number(m[2]), Number(m[3]));
      break;
    }
    case "DD MMM YYYY": {
      const m = /^(\d{1,2})[\s\-./]+([a-z]+)\.?(?:[\s\-./]+(\d{4}|\d{2}))?$/i.exec(s);
      if (!m) return null;
      const month = MONTHS[m[2]!.toLowerCase()];
      if (!month) return null;
      const day = Number(m[1]);
      date = m[3] ? build(fullYear(m[3]), month, day) : withInferredYear(month, day, referenceDate);
      break;
    }
  }
  return date ? { date, time: parts.time } : null;
}

/** Semua tanggal dengan tahun di sebuah teks (baris judul bank "Periode : 01/09/2026 - 30/09/2026"). */
export function datesInText(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/g)) {
    let d: string | null = null;
    if (m[1]) d = build(Number(m[3]), Number(m[2]), Number(m[1]));
    else if (m[4]) d = build(Number(m[4]), Number(m[5]), Number(m[6]));
    else if (m[7]) {
      const month = MONTHS[m[8]!.toLowerCase()];
      d = month ? build(Number(m[9]), month, Number(m[7])) : null;
    }
    if (d) found.push(d);
  }
  return found;
}

/**
 * Format yang membaca paling banyak sel. DD/MM menang atas MM/DD kalau sama banyak, karena bank Indonesia
 * memakai urutan hari dulu; MM/DD hanya terpilih kalau ada hari > 12 di posisi kedua.
 */
export function detectDateFormat(values: readonly string[], referenceDate: string): CsvDateFormat | null {
  const sample = values.map((v) => v.trim()).filter(Boolean).slice(0, 200);
  if (sample.length === 0) return null;
  let best: { format: CsvDateFormat; hits: number } | null = null;
  for (const format of CSV_DATE_FORMATS) {
    const hits = sample.filter((v) => parseCsvDate(v, format, referenceDate) !== null).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { format, hits };
  }
  return best && best.hits / sample.length >= 0.5 ? best.format : null;
}

export function looksLikeDate(value: string, referenceDate: string): boolean {
  return CSV_DATE_FORMATS.some((f) => parseCsvDate(value, f, referenceDate) !== null);
}
