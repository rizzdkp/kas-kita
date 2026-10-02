import type { CsvMapping } from "../types";

export type CsvEncoding = CsvMapping["encoding"];

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

export function hasUtf8Bom(bytes: Uint8Array): boolean {
  return UTF8_BOM.every((b, i) => bytes[i] === b);
}

/** UTF-8 kalau ber-BOM atau valid UTF-8; selain itu Windows-1252 (ekspor Excel lama dari internet banking). */
export function detectEncoding(bytes: Uint8Array): CsvEncoding {
  if (hasUtf8Bom(bytes)) return "utf-8";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

export function decodeCsv(bytes: Uint8Array, encoding: CsvEncoding): string {
  const body = encoding === "utf-8" && hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes;
  return new TextDecoder(encoding).decode(body);
}

// PDF, gambar, ZIP (xlsx), dan UTF-16 selalu memuat byte NUL di awal file; CSV teks tidak pernah
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control += 1;
  }
  return control / sample.length < 0.01;
}
