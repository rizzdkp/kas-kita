import { z } from "zod";

/**
 * Isi kolom recurring_rules.template (DATA-MODEL): field transaksi kecuali tanggal.
 * Nominal disimpan sebagai string digit supaya bigint utuh di jsonb.
 */
export const recurringTemplateSchema = z
  .object({
    kind: z.enum(["income", "expense", "transfer"]),
    amount: z.string().regex(/^[1-9]\d{0,18}$/),
    accountId: z.uuid(),
    toAccountId: z.uuid().nullable().default(null),
    categoryId: z.uuid().nullable().default(null),
    note: z.string().max(500).nullable().default(null),
    beneficiary: z.enum(["owner", "partner_of_owner", "shared"]).default("owner"),
    tagNames: z.array(z.string().min(1).max(40)).max(20).default([]),
  })
  .refine((t) => (t.kind === "transfer" ? t.toAccountId !== null && t.categoryId === null : t.toAccountId === null && t.categoryId !== null));

export type RecurringTemplate = z.output<typeof recurringTemplateSchema>;

/** Template rusak (diubah manual di database) tidak boleh menjatuhkan halaman atau job; null berarti lewati. */
export function parseTemplate(value: unknown): RecurringTemplate | null {
  const parsed = recurringTemplateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function templateAmount(t: RecurringTemplate): bigint {
  return BigInt(t.amount);
}
