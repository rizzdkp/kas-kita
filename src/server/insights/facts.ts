import { z } from "zod";

// fakta dihitung kode (F-AI-2 AC1); nominal disimpan sebagai string desimal karena jsonb tidak memuat bigint
const money = z.string().regex(/^-?\d+$/);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const insightLinkSchema = z.object({
  categoryIds: z.array(z.uuid()).optional(),
  kinds: z.array(z.literal("expense")).optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
  q: z.string().max(200).optional(),
});
export type InsightLink = z.infer<typeof insightLinkSchema>;

const base = { link: insightLinkSchema };

export const insightFactSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("kategori_naik"),
    categoryId: z.uuid(),
    categoryName: z.string(),
    current: money,
    average: money,
    increasePercent: z.number(),
    ...base,
  }),
  z.object({ kind: z.literal("kategori_baru"), categoryId: z.uuid(), categoryName: z.string(), current: money, ...base }),
  z.object({ kind: z.literal("anggaran_lewat"), categoryId: z.uuid(), categoryName: z.string(), usedPercent: z.number(), ...base }),
  z.object({
    kind: z.literal("anggaran_cepat"),
    categoryId: z.uuid(),
    categoryName: z.string(),
    usedPercent: z.number(),
    elapsedPercent: z.number(),
    ...base,
  }),
  z.object({ kind: z.literal("tagihan"), billId: z.uuid(), name: z.string(), amount: money, dueOn: dateKey, ...base }),
  z.object({ kind: z.literal("total_minggu"), total: money, count: z.number().int().nonnegative(), ...base }),
]);

export type InsightFact = z.infer<typeof insightFactSchema>;
export type InsightFactKind = InsightFact["kind"];

export const MAX_WEEKLY_INSIGHTS = 3;

/** Fakta beserta id transaksi penyusunnya (F-AI-2 AC3). */
export interface CollectedFact {
  fact: InsightFact;
  sourceTransactionIds: string[];
}

// urutan prioritas: perubahan kategori, laju anggaran wajib, tagihan minggu ini, total minggu
const PRIORITY: Record<InsightFactKind, number> = {
  kategori_naik: 0,
  kategori_baru: 0,
  anggaran_lewat: 1,
  anggaran_cepat: 1,
  tagihan: 2,
  total_minggu: 3,
};

export function compareFactKinds(a: InsightFactKind, b: InsightFactKind): number {
  return PRIORITY[a] - PRIORITY[b];
}

/** Maksimal tiga wawasan per minggu per cakupan. */
export function selectFacts(facts: CollectedFact[]): CollectedFact[] {
  return [...facts].sort((a, b) => compareFactKinds(a.fact.kind, b.fact.kind)).slice(0, MAX_WEEKLY_INSIGHTS);
}
