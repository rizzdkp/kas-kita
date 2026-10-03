import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { toJakarta } from "@/lib/dates";

/** Folder lampiran di volume tanpa akses publik (SECURITY.md); disajikan hanya lewat route bersesi. */
export function attachmentsRoot(): string {
  return resolve(process.env.ATTACHMENTS_DIR ?? "./data/attachments");
}

/** <yyyy>/<mm>/<id>.jpg memakai bulan WIB supaya folder cocok dengan tanggal yang dilihat pengguna. */
export function buildStorageKey(id: string, now: Date = new Date()): string {
  const z = toJakarta(now);
  return `${z.getFullYear()}/${String(z.getMonth() + 1).padStart(2, "0")}/${id}.jpg`;
}

// storage_key berasal dari database, tetapi tetap dicegah keluar dari folder lampiran
export function resolveStoragePath(storageKey: string, root: string = attachmentsRoot()): string | null {
  const full = resolve(root, storageKey);
  return full.startsWith(resolve(root) + sep) ? full : null;
}

export async function writeAttachmentFile(storageKey: string, data: Buffer): Promise<void> {
  const path = resolveStoragePath(storageKey);
  if (!path) throw new Error("storage key tidak valid");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data, { flag: "wx", mode: 0o640 });
}

export async function readAttachmentFile(storageKey: string): Promise<Buffer | null> {
  const path = resolveStoragePath(storageKey);
  return path ? readFile(path).catch(() => null) : null;
}

export async function removeAttachmentFile(storageKey: string): Promise<void> {
  const path = resolveStoragePath(storageKey);
  if (path) await rm(path, { force: true });
}
