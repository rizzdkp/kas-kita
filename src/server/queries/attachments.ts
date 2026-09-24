import { and, asc, eq, isNull } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { attachments, categories, transactionSplits, users } from "@/server/db/schema";

export type AttachmentRow = typeof attachments.$inferSelect;

export interface AttachmentMeta {
  id: string;
  version: number;
  transactionId: string | null;
  mime: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedByName: string;
}

export interface TransactionSplitView {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: bigint;
  note: string | null;
}

/** Satu lampiran yang belum dihapus; rumah tangga dua orang, jadi siapa pun yang login boleh melihat. */
export async function getAttachment(id: string, db: DbOrTx = defaultDb): Promise<AttachmentRow | null> {
  const [row] = await db.select().from(attachments).where(and(eq(attachments.id, id), isNull(attachments.deletedAt)));
  return row ?? null;
}

export async function listTransactionAttachments(transactionId: string, db: DbOrTx = defaultDb): Promise<AttachmentMeta[]> {
  return db
    .select({
      id: attachments.id,
      version: attachments.version,
      transactionId: attachments.transactionId,
      mime: attachments.mime,
      sizeBytes: attachments.sizeBytes,
      createdAt: attachments.createdAt,
      uploadedByName: users.displayName,
    })
    .from(attachments)
    .innerJoin(users, eq(users.id, attachments.uploadedBy))
    .where(and(eq(attachments.transactionId, transactionId), isNull(attachments.deletedAt)))
    .orderBy(asc(attachments.createdAt));
}

/** Rincian kategori transaksi struk yang dipecah, urut nominal terbesar. */
export async function listTransactionSplits(transactionId: string, db: DbOrTx = defaultDb): Promise<TransactionSplitView[]> {
  const rows = await db
    .select({
      id: transactionSplits.id,
      categoryId: transactionSplits.categoryId,
      categoryName: categories.name,
      amount: transactionSplits.amount,
      note: transactionSplits.note,
    })
    .from(transactionSplits)
    .innerJoin(categories, eq(categories.id, transactionSplits.categoryId))
    .where(eq(transactionSplits.transactionId, transactionId));
  return rows.sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));
}
