import { z } from "zod";
import { parseAmount } from "@/lib/money";
import { parseDateKey } from "@/lib/dates";
import type { ParsedRow } from "@/server/import/types";

export const PDF_EXTRACT_SCHEMA_NAME = "pdf_extract";

// skema ketat untuk server (semua field wajib, boleh null) supaya cocok dengan mode strict json_schema
const strictRow = z.object({
  date: z.string().describe("Tanggal transaksi YYYY-MM-DD"),
  time: z.string().nullable().describe("HH:mm 24 jam, atau null"),
  description: z.string().describe("Keterangan persis seperti tertulis, tanpa nominal"),
  amount: z
    .union([z.string(), z.number().int()])
    .describe("Nominal rupiah bertanda: negatif untuk uang keluar (debit), positif untuk uang masuk (kredit). Salin angka seperti tertulis"),
  balance: z.union([z.string(), z.number().int()]).nullable().describe("Saldo setelah transaksi bila tertulis, atau null"),
});

export const pdfExtractAiStrictSchema = z.object({ rows: z.array(strictRow) });

export const pdfExtractAiJsonSchema = z.toJSONSchema(pdfExtractAiStrictSchema) as Record<string, unknown>;

// validasi longgar: baris rusak tidak menggagalkan seluruh jawaban, disaring saat normalisasi
const loose = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null).transform((v) => v ?? null);
const amountLike = z.union([z.string().max(60), z.number()]);

const looseRow = z.object({
  date: loose(z.string().max(40)),
  time: loose(z.string().max(20)),
  description: loose(z.string().max(500)),
  amount: loose(amountLike),
  balance: loose(amountLike),
});

export const pdfExtractAiSchema = z.object({ rows: z.array(looseRow.nullable().catch(null)).max(2000) });

export type PdfExtractAiOutput = z.infer<typeof pdfExtractAiSchema>;
type AiRow = NonNullable<PdfExtractAiOutput["rows"][number]>;

const DEBIT_RE = /\s*(?:\(?\b(?:db|dr|d|debit|debet)\b\)?)$/i;
const CREDIT_RE = /\s*(?:\(?\b(?:cr|k|kr|kredit|credit)\b\)?)$/i;

/** Nominal model menjadi rupiah bulat bertanda; penanda DB/CR di akhir teks ikut dibaca. */
export function toSignedRupiah(v: string | number | null): bigint | null {
  if (v === null) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) return null;
    return BigInt(Math.round(v));
  }
  let s = v.trim().replace(/^\+/, "");
  let sign = 1n;
  if (DEBIT_RE.test(s)) {
    s = s.replace(DEBIT_RE, "");
    sign = -1n;
  } else if (CREDIT_RE.test(s)) {
    s = s.replace(CREDIT_RE, "");
  }
  // "(45.000)" gaya akuntansi berarti negatif
  const paren = /^\((.+)\)$/.exec(s);
  if (paren) {
    s = paren[1]!;
    sign = -1n;
  }
  const parsed = parseAmount(s);
  if (parsed === null) return null;
  return sign < 0n && parsed > 0n ? -parsed : parsed;
}

function cleanDate(v: string | null, today: string): string | null {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  const dmy = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(v.trim());
  const key = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : null;
  if (!key || !parseDateKey(key)) return null;
  // tanggal di masa depan hampir pasti salah baca
  return key <= today ? key : null;
}

function cleanTime(v: string | null): string | null {
  const m = v ? /^(\d{1,2})[:.](\d{2})/.exec(v.trim()) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
}

function rawOf(row: AiRow, page: number): Record<string, string> {
  return {
    tanggal: row.date ?? "",
    jam: row.time ?? "",
    keterangan: row.description ?? "",
    nominal: row.amount === null ? "" : String(row.amount),
    saldo: row.balance === null ? "" : String(row.balance),
    halaman: String(page),
  };
}

/**
 * Jawaban model menjadi ParsedRow. Baris tanpa tanggal valid, bertanggal masa depan, bernominal nol,
 * atau tanpa keterangan ditolak dan dihitung, bukan ditebak.
 */
export function normalizePdfAiRows(
  output: PdfExtractAiOutput,
  opts: { today: string; page: number },
): { rows: ParsedRow[]; rejected: number } {
  const rows: ParsedRow[] = [];
  let rejected = 0;
  for (const row of output.rows) {
    if (!row) {
      rejected += 1;
      continue;
    }
    const date = cleanDate(row.date, opts.today);
    const amount = toSignedRupiah(row.amount);
    const description = (row.description ?? "").replace(/\s+/g, " ").trim();
    if (!date || amount === null || amount === 0n || !description) {
      rejected += 1;
      continue;
    }
    rows.push({
      date,
      time: cleanTime(row.time),
      description,
      amount,
      balance: toSignedRupiah(row.balance),
      raw: rawOf(row, opts.page),
    });
  }
  return { rows, rejected };
}
