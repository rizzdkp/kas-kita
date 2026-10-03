import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatRupiah } from "@/lib/money";
import { groupLinesByCategory, primaryCategoryId, splitNote, sumLines } from "@/components/receipts/receipt-math";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { transactions, transactionSplits } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { amountSchema, inTransaction, parseInput, signedAmountSchema } from "./_shared";
import { linkAttachment } from "./attachments";
import { insertWithAudit } from "./audit";
import { assertReferences } from "./transaction-input";
import { createTransaction, type TransactionRow } from "./transactions";

export type TransactionSplitRow = typeof transactionSplits.$inferSelect;

const itemSchema = z.object({
  name: z.string().max(200).default(""),
  amount: signedAmountSchema,
  categoryId: z.uuid().nullable(),
});

export const saveReceiptSchema = z.object({
  attachmentId: z.uuid(),
  clientId: z.string().min(8).max(100),
  mode: z.enum(["single", "split"]),
  amount: amountSchema,
  accountId: z.uuid(),
  categoryId: z.uuid().nullish().transform((v) => v ?? null),
  occurredAt: z.coerce.date(),
  note: z
    .string()
    .max(500)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  beneficiary: z.enum(["owner", "partner_of_owner", "shared"]).default("owner"),
  items: z.array(itemSchema).max(200).default([]),
});
export type SaveReceiptInput = z.input<typeof saveReceiptSchema>;

export interface SavedReceipt {
  transaction: TransactionRow;
  splits: TransactionSplitRow[];
}

export const SPLIT_MESSAGES = {
  missingCategory: "Pilih kategori untuk setiap item sebelum memecah per kategori.",
  nonPositive: "Nominal per kategori harus lebih dari nol. Gabungkan potongan harga dengan item di kategori yang sama.",
  mismatch: (items: bigint, total: bigint) =>
    `Jumlah item ${formatRupiah(items)} belum sama dengan total ${formatRupiah(total)}. Samakan dulu sebelum memecah per kategori.`,
} as const;

type ParsedReceipt = z.output<typeof saveReceiptSchema>;

/** Kelompok split per kategori, atau null kalau semua item satu kategori (cukup transaksi biasa). */
function planSplits(data: ParsedReceipt): { categoryId: string; groups: Array<{ categoryId: string; amount: bigint; note: string | null }> | null } {
  if (data.items.length === 0) throw new ValidationError(SPLIT_MESSAGES.missingCategory, { items: [SPLIT_MESSAGES.missingCategory] });
  if (data.items.some((i) => !i.categoryId)) throw new ValidationError(SPLIT_MESSAGES.missingCategory, { items: [SPLIT_MESSAGES.missingCategory] });
  const itemsTotal = sumLines(data.items);
  if (itemsTotal !== data.amount) {
    const message = SPLIT_MESSAGES.mismatch(itemsTotal, data.amount);
    throw new ValidationError(message, { items: [message] });
  }
  const groups = groupLinesByCategory(data.items);
  if (groups.some((g) => g.amount <= 0n)) throw new ValidationError(SPLIT_MESSAGES.nonPositive, { items: [SPLIT_MESSAGES.nonPositive] });
  const main = primaryCategoryId(groups)!;
  if (groups.length === 1) return { categoryId: main, groups: null };
  return { categoryId: main, groups: groups.map((g) => ({ categoryId: g.categoryId!, amount: g.amount, note: splitNote(g.names) })) };
}

/**
 * Simpan transaksi dari foto struk (F-IN-3 AC3/AC4): satu transaksi, dipecah per kategori lewat transaction_splits
 * bila diminta, lalu foto ditautkan sebagai lampiran. Semua dalam satu transaksi database; trigger deferred
 * memastikan jumlah split sama dengan nominal saat commit.
 */
export async function saveReceiptTransaction(viewer: Viewer, input: SaveReceiptInput, db: DbOrTx = defaultDb): Promise<SavedReceipt> {
  const data = parseInput(saveReceiptSchema, input);
  const plan = data.mode === "split" ? planSplits(data) : { categoryId: data.categoryId, groups: null };

  return inTransaction(db, async (tx) => {
    const [existing] = await tx.select().from(transactions).where(eq(transactions.clientId, data.clientId));
    if (existing) {
      // kiriman ulang dari tombol yang ditekan dua kali: kembalikan hasil pertama
      await linkAttachment(tx, viewer, data.attachmentId, existing.id);
      const splits = await tx.select().from(transactionSplits).where(eq(transactionSplits.transactionId, existing.id));
      return { transaction: existing, splits };
    }

    const transaction = await createTransaction(
      viewer,
      {
        kind: "expense",
        amount: data.amount,
        accountId: data.accountId,
        categoryId: plan.categoryId,
        occurredAt: data.occurredAt,
        note: data.note,
        beneficiary: data.beneficiary,
        source: "receipt",
        clientId: data.clientId,
      },
      tx,
    );

    const splits: TransactionSplitRow[] = [];
    if (plan.groups) {
      await assertReferences(
        tx,
        plan.groups.map((g) => ({ kind: "expense", accountId: data.accountId, toAccountId: null, categoryId: g.categoryId })),
      );
      for (const g of plan.groups) {
        splits.push(await insertWithAudit(tx, transactionSplits, { transactionId: transaction.id, ...g }, viewer.user.id));
      }
    }
    await linkAttachment(tx, viewer, data.attachmentId, transaction.id);
    return { transaction, splits };
  });
}
