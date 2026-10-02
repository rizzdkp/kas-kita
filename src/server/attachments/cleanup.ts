import { and, isNull, lt } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { attachments } from "@/server/db/schema";
import { loadViewerForUser } from "@/server/jobs/viewer";
import { deleteAttachment } from "@/server/mutations/attachments";
import { removeAttachmentFile } from "./storage";

export const ORPHAN_ATTACHMENT_DAYS = 7;

/**
 * Lampiran pratinjau struk yang tidak pernah tertaut ke transaksi > 7 hari: hapus lunak lewat mutasi
 * (audit atas nama pengunggah) lalu hapus filenya. Lampiran yang tertaut tidak pernah disentuh.
 */
export async function cleanupOrphanAttachments(now: Date = new Date(), db: DbOrTx = defaultDb): Promise<{ removed: number; failed: number }> {
  const cutoff = new Date(now.getTime() - ORPHAN_ATTACHMENT_DAYS * 24 * 60 * 60 * 1000);
  const orphans = await db
    .select({ id: attachments.id, version: attachments.version, storageKey: attachments.storageKey, uploadedBy: attachments.uploadedBy })
    .from(attachments)
    .where(and(isNull(attachments.transactionId), isNull(attachments.deletedAt), lt(attachments.createdAt, cutoff)));
  let removed = 0;
  let failed = 0;
  for (const row of orphans) {
    try {
      const viewer = await loadViewerForUser(row.uploadedBy, db);
      if (!viewer) throw new Error("pengunggah tidak ada");
      await deleteAttachment(viewer, { id: row.id, version: row.version }, db);
      await removeAttachmentFile(row.storageKey);
      removed += 1;
    } catch {
      // satu lampiran gagal (misalnya baru ditautkan bersamaan) tidak menghentikan pembersihan lainnya
      failed += 1;
    }
  }
  return { removed, failed };
}
