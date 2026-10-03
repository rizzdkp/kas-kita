import { removeAttachmentFile } from "@/server/attachments/storage";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { purgeDeletedRows } from "@/server/mutations/purge";

export const JOB_PURGE_DELETED = "purge.deleted";

/** 03.00 WIB: hapus permanen data terhapus > 30 hari, lalu file lampirannya setelah commit. */
export async function handlePurgeDeletedJob(
  opts: { now?: Date; db?: DbOrTx; removeFile?: (key: string) => Promise<void> } = {},
): Promise<Record<string, number>> {
  const { counts, storageKeys } = await purgeDeletedRows(opts.now ?? new Date(), opts.db ?? defaultDb);
  const remove = opts.removeFile ?? removeAttachmentFile;
  let fileErrors = 0;
  for (const key of storageKeys) {
    // file yang gagal dihapus tidak lagi dirujuk baris mana pun; cukup dihitung
    await remove(key).catch(() => {
      fileErrors += 1;
    });
  }
  return { ...counts, fileErrors };
}
