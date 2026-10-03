import { z } from "zod";
import { parseDateKey, todayJakarta } from "@/lib/dates";
import type { ReceiptLine } from "@/components/receipts/receipt-math";

export const RECEIPT_SCHEMA_NAME = "receipt";

// skema ketat untuk server (semua field wajib, boleh null) supaya cocok dengan mode strict json_schema
const strictItem = z.object({
  name: z.string().describe("Nama item persis seperti tertulis di struk"),
  amount: z.number().describe("Harga total baris dalam rupiah bulat; potongan harga bernilai negatif"),
  categoryName: z.string().nullable().describe("Salin persis dari daftar kategori, atau null"),
});

export const receiptAiStrictSchema = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable().describe("YYYY-MM-DD"),
  time: z.string().nullable().describe("HH:mm, 24 jam"),
  total: z.number().nullable().describe("Total yang dibayar dalam rupiah bulat"),
  items: z.array(strictItem),
});

export const receiptAiJsonSchema = z.toJSONSchema(receiptAiStrictSchema) as Record<string, unknown>;

// validasi longgar: field yang tidak dikirim model dianggap kosong
const loose = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null).transform((v) => v ?? null);

const looseItem = z.object({
  name: z.string().max(200).catch(""),
  amount: z.coerce.number().finite(),
  categoryName: loose(z.string().max(120)),
});

export const receiptAiSchema = z.object({
  merchant: loose(z.string().max(200)),
  date: loose(z.string().max(40)),
  time: loose(z.string().max(20)),
  total: loose(z.coerce.number().finite()),
  items: z.array(looseItem).max(200).catch([]),
});

export type ReceiptAiOutput = z.infer<typeof receiptAiSchema>;

/** Hasil baca struk yang siap diedit di pratinjau; kategori sudah dipetakan ke id. */
export interface ReceiptDraft {
  merchant: string | null;
  /** YYYY-MM-DD, WIB. */
  date: string | null;
  /** HH:mm. */
  time: string | null;
  total: bigint | null;
  items: ReceiptLine[];
}

export const EMPTY_RECEIPT_DRAFT: ReceiptDraft = { merchant: null, date: null, time: null, total: null, items: [] };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function toRupiah(n: number | null): bigint | null {
  if (n === null || !Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) return null;
  return BigInt(Math.round(n));
}

// tanggal di masa depan hampir pasti salah baca; lebih baik kosong dan diisi tangan
function cleanDate(v: string | null, today: string): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !parseDateKey(v)) return null;
  return v <= today ? v : null;
}

function cleanTime(v: string | null): string | null {
  const m = v ? /^(\d{1,2})[:.](\d{2})/.exec(v) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
}

/** Output model menjadi draf: nama kategori di luar daftar jadi kosong, angka dibulatkan ke rupiah. */
export function normalizeReceipt(
  output: ReceiptAiOutput,
  categories: ReadonlyArray<{ id: string; name: string }>,
  today: string = todayJakarta(),
): ReceiptDraft {
  const byName = new Map(categories.map((c) => [norm(c.name), c.id]));
  const items: ReceiptLine[] = [];
  for (const item of output.items.slice(0, 100)) {
    const amount = toRupiah(item.amount);
    const name = item.name.trim().slice(0, 120);
    if (amount === null || (amount === 0n && !name)) continue;
    items.push({ name, amount, categoryId: item.categoryName ? (byName.get(norm(item.categoryName)) ?? null) : null });
  }
  const total = toRupiah(output.total);
  return {
    merchant: output.merchant?.trim().slice(0, 120) || null,
    date: cleanDate(output.date, today),
    time: cleanTime(output.time),
    total: total !== null && total > 0n ? total : null,
    items,
  };
}
