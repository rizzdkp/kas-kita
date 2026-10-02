import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type ImportFileExt = "csv" | "pdf";

const EXTS: readonly ImportFileExt[] = ["csv", "pdf"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
// SECURITY.md: file mutasi sementara dihapus setelah commit/gagal, atau oleh job pembersihan
export const IMPORT_FILE_MAX_AGE_DAYS = 7;

/** Folder file impor sementara, di luar folder publik. */
export function importsRoot(): string {
  return resolve(process.env.IMPORTS_DIR ?? "./data/imports");
}

// nama file hanya dari batchId (uuid) dan ekstensi tetap, jadi tidak pernah keluar dari folder impor
export function importFilePath(batchId: string, ext: ImportFileExt, root: string = importsRoot()): string {
  if (!UUID.test(batchId)) throw new Error("batchId tidak valid");
  return join(root, `${batchId.toLowerCase()}.${ext}`);
}

export async function saveImportFile(batchId: string, ext: ImportFileExt, data: Uint8Array): Promise<void> {
  const path = importFilePath(batchId, ext);
  await mkdir(importsRoot(), { recursive: true, mode: 0o750 });
  await writeFile(path, data, { mode: 0o640 });
}

export async function readImportFile(batchId: string, ext: ImportFileExt): Promise<Buffer | null> {
  if (!UUID.test(batchId)) return null;
  return readFile(importFilePath(batchId, ext)).catch(() => null);
}

/** Hapus file batch; tanpa `ext` semua ekstensi dihapus. Aman dipanggil berulang. */
export async function deleteImportFile(batchId: string, ext?: ImportFileExt): Promise<void> {
  if (!UUID.test(batchId)) return;
  await Promise.all((ext ? [ext] : EXTS).map((e) => rm(importFilePath(batchId, e), { force: true })));
}

/** Hapus file impor yang lebih tua dari `maxAgeDays`; mengembalikan jumlah file yang dihapus. */
export async function cleanupImportFiles(maxAgeDays: number = IMPORT_FILE_MAX_AGE_DAYS, now: Date = new Date()): Promise<number> {
  const root = importsRoot();
  const names = await readdir(root).catch(() => [] as string[]);
  const cutoff = now.getTime() - maxAgeDays * DAY_MS;
  let removed = 0;
  for (const name of names) {
    const [id, ext] = name.split(".");
    if (!id || !UUID.test(id) || !EXTS.includes(ext as ImportFileExt)) continue;
    const path = join(root, name);
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs < cutoff) {
      await rm(path, { force: true });
      removed += 1;
    }
  }
  return removed;
}
