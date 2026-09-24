import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { attachments, transactions } from "@/server/db/schema";
import { DomainError, NotFoundError } from "@/server/errors";
import { inTransaction, parseInput, versionSchema } from "./_shared";
import { insertWithAudit, selectById, softDeleteWithAudit, updateWithAudit } from "./audit";

export type AttachmentRecord = typeof attachments.$inferSelect;

export const ATTACHMENT_NOT_FOUND = "Foto ini tidak ditemukan, mungkin sudah dihapus. Unggah ulang fotonya.";
export const ATTACHMENT_ALREADY_LINKED = "Foto struk ini sudah tersimpan di transaksi lain.";

const createAttachmentSchema = z.object({
  id: z.uuid(),
  storageKey: z.string().regex(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/),
  mime: z.literal("image/jpeg"),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

/** Baris lampiran baru; transaction_id null selama masih di pratinjau (DATA-MODEL attachments). */
export async function createAttachment(
  viewer: Viewer,
  input: z.input<typeof createAttachmentSchema>,
  db: DbOrTx = defaultDb,
): Promise<AttachmentRecord> {
  const data = parseInput(createAttachmentSchema, input);
  return inTransaction(db, (tx) => insertWithAudit(tx, attachments, { ...data, uploadedBy: viewer.user.id }, viewer.user.id));
}

/** Tautkan lampiran ke transaksi di dalam transaksi database pemanggil; idempoten untuk transaksi yang sama. */
export async function linkAttachment(tx: Tx, viewer: Viewer, attachmentId: string, transactionId: string): Promise<AttachmentRecord> {
  const current = await selectById(tx, attachments, attachmentId, true);
  if (!current || current.deletedAt) throw new DomainError("not_found", ATTACHMENT_NOT_FOUND);
  if (current.transactionId === transactionId) return current;
  if (current.transactionId) throw new DomainError("attachment_linked", ATTACHMENT_ALREADY_LINKED);
  const target = await selectById(tx, transactions, transactionId);
  if (!target || target.deletedAt) throw new NotFoundError("transactions", transactionId);
  const result = await updateWithAudit(tx, attachments, {
    id: attachmentId,
    expectedVersion: current.version,
    actorId: viewer.user.id,
    values: { transactionId },
  });
  return result.after;
}

/** Lampiran untuk transaksi yang sudah ada (F-IN-1 field lampiran). */
export async function attachToTransaction(
  viewer: Viewer,
  input: { attachmentId: string; transactionId: string },
  db: DbOrTx = defaultDb,
): Promise<AttachmentRecord> {
  const { attachmentId, transactionId } = parseInput(z.object({ attachmentId: z.uuid(), transactionId: z.uuid() }), input);
  return inTransaction(db, (tx) => linkAttachment(tx, viewer, attachmentId, transactionId));
}

/** Hapus lunak; file tetap di disk supaya riwayat dan ekspor bisa menjelaskan apa yang pernah ada. */
export async function deleteAttachment(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<AttachmentRecord> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const current = await selectById(tx, attachments, id);
    if (!current || current.deletedAt) throw new DomainError("not_found", ATTACHMENT_NOT_FOUND);
    return (await softDeleteWithAudit(tx, attachments, { id, expectedVersion: version, actorId: viewer.user.id })).after;
  });
}
