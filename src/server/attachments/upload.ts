import { createHash } from "node:crypto";
import { uuidv7 } from "@/lib/uuid";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { attachToTransaction, createAttachment, type AttachmentRecord } from "@/server/mutations/attachments";
import { RECEIPT_MAX_BYTES, reencodeImage, UPLOAD_MESSAGES, UploadError } from "./image";
import { buildStorageKey, removeAttachmentFile, writeAttachmentFile } from "./storage";

/** Baca body sampai batas; berhenti lebih awal supaya file raksasa tidak ditampung utuh di memori. */
export async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number = RECEIPT_MAX_BYTES): Promise<Buffer> {
  if (!body) throw new UploadError(400, UPLOAD_MESSAGES.empty);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new UploadError(413, UPLOAD_MESSAGES.tooLarge);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export interface StoredAttachment {
  id: string;
  width: number;
  height: number;
  transactionId: string | null;
}

/** Unggah foto: cek ukuran, magic bytes, decode ulang tanpa EXIF, simpan file lalu barisnya. */
export async function storeUploadedImage(
  viewer: Viewer,
  request: Pick<Request, "body" | "headers">,
  opts: { transactionId?: string | null; now?: Date } = {},
  db: DbOrTx = defaultDb,
): Promise<StoredAttachment> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > RECEIPT_MAX_BYTES) throw new UploadError(413, UPLOAD_MESSAGES.tooLarge);
  const raw = await readLimited(request.body);
  const image = await reencodeImage(raw);
  const id = uuidv7();
  const storageKey = buildStorageKey(id, opts.now);
  await writeAttachmentFile(storageKey, image.data);
  let row: AttachmentRecord;
  try {
    // baris dan tautan dalam satu transaksi: kalau transaksi tujuan tidak ada, tidak ada baris yatim
    row = await db.transaction(async (tx) => {
      const sha256 = createHash("sha256").update(image.data).digest("hex");
      const created = await createAttachment(viewer, { id, storageKey, mime: "image/jpeg", sizeBytes: image.data.length, sha256 }, tx);
      if (!opts.transactionId) return created;
      return attachToTransaction(viewer, { attachmentId: id, transactionId: opts.transactionId }, tx);
    });
  } catch (e) {
    await removeAttachmentFile(storageKey);
    throw e;
  }
  return { id: row.id, width: image.width, height: image.height, transactionId: row.transactionId };
}
