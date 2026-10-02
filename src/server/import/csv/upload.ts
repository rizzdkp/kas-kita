import { createHash } from "node:crypto";
import { todayJakarta } from "@/lib/dates";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { DomainError, ValidationError } from "@/server/errors";
import { saveImportTemplate } from "@/server/mutations/import-templates";
import { getAccount, type AccountWithBalance } from "@/server/queries/accounts";
import { getImportTemplateForInstitution } from "@/server/queries/import-templates";
import { getImportBatch } from "@/server/queries/imports";
import { deleteImportFile, readImportFile, saveImportFile } from "../files";
import { createImportBatch, failImportBatch, saveParsedRows } from "../pipeline";
import type { CsvMapping } from "../types";
import { detectHeaderRow, detectReferenceDate } from "./detect";
import { decodeCsv, detectEncoding } from "./encoding";
import { inspectCsv, templateFits } from "./inspect";
import { csvMappingSchema } from "./mapping-schema";
import { columnNames, CsvMappingError, decodeTable, hasBlockingSkips, parseCsvTable, tableWidth, type CsvParseResult } from "./parse";
import { tokenizeCsv } from "./tokenize";

export const IMPORT_ACCOUNT_TYPES = ["bank", "ewallet", "credit_card"] as const;

export const CSV_MESSAGES = {
  notCsv: "File ini tidak terbaca sebagai tabel CSV. Pilih file CSV atau PDF mutasi dari bank.",
  accountType: "Impor mutasi hanya untuk akun bank, e-wallet, atau kartu kredit. Pilih akun lain.",
  noRows: "Tidak ada baris yang terbaca dengan pemetaan ini. Cek kolom tanggal, format tanggal, dan kolom nominal.",
  fileGone: "File mutasi ini sudah tidak tersimpan. Unggah file-nya lagi.",
  notMapping: "Impor ini sudah tidak bisa dipetakan ulang. Unggah file mutasi lagi.",
} as const;

export type CsvUploadResult = { status: "review" | "mapping"; batchId: string };

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertImportAccount(account: AccountWithBalance): void {
  if (account.archivedAt || !(IMPORT_ACCOUNT_TYPES as readonly string[]).includes(account.type)) {
    throw new ValidationError(CSV_MESSAGES.accountType, { accountId: [CSV_MESSAGES.accountType] });
  }
}

export function referenceDateFor(bytes: Uint8Array, mapping: CsvMapping, today: string): string {
  const table = tokenizeCsv(decodeCsv(bytes, mapping.encoding), mapping.delimiter, 60);
  return detectReferenceDate(table, mapping.headerRow, today);
}

export function parseWithMapping(bytes: Uint8Array, mapping: CsvMapping, today: string): CsvParseResult {
  return parseCsvTable(decodeTable(bytes, mapping), mapping, referenceDateFor(bytes, mapping, today));
}

/**
 * Templat dipakai apa adanya kalau kolomnya ada di file; kalau baris judul bank bertambah atau berkurang,
 * baris header dideteksi ulang. Encoding selalu dari file karena bisa berbeda antar unduhan.
 */
export function fitTemplate(bytes: Uint8Array, template: CsvMapping, today: string): CsvMapping | null {
  const encoding = detectEncoding(bytes);
  const table = tokenizeCsv(decodeCsv(bytes, encoding), template.delimiter);
  const width = tableWidth(table);
  const headerFits = (row: number) => templateFits(template, columnNames(row >= 0 ? (table[row] ?? null) : null, width));
  if (headerFits(template.headerRow)) return { ...template, encoding };
  const detected = detectHeaderRow(table, today);
  return headerFits(detected) ? { ...template, encoding, headerRow: detected } : null;
}

async function tryTemplate(viewer: Viewer, batchId: string, bytes: Uint8Array, institutionId: string, today: string, db: DbOrTx): Promise<boolean> {
  const template = await getImportTemplateForInstitution(institutionId, db);
  if (!template) return false;
  const mapping = fitTemplate(bytes, template.mapping, today);
  if (!mapping) return false;
  try {
    const result = parseWithMapping(bytes, mapping, today);
    // baris rusak ditampilkan di langkah pemetaan, bukan dibuang diam-diam
    if (result.rows.length === 0 || hasBlockingSkips(result.skipped)) return false;
    await saveParsedRows(viewer, batchId, result.rows, db);
    return true;
  } catch (e) {
    if (e instanceof CsvMappingError) return false;
    throw e;
  }
}

/** Unggah CSV: batch baru, simpan file sementara, lalu templat institusi (langsung ke tinjau) atau langkah pemetaan. */
export async function handleCsvUpload(
  viewer: Viewer,
  input: { accountId: string; bytes: Uint8Array },
  opts: { today?: string } = {},
  db: DbOrTx = defaultDb,
): Promise<CsvUploadResult> {
  const today = opts.today ?? todayJakarta();
  const account = await getAccount(input.accountId, db);
  assertImportAccount(account);
  const inspection = inspectCsv(input.bytes, today);
  if (inspection.columns.length < 2 || inspection.table.length < 2) throw new ValidationError(CSV_MESSAGES.notCsv);

  const batch = await createImportBatch(viewer, { accountId: account.id, institutionId: account.institutionId, format: "csv", fileSha256: sha256Hex(input.bytes) }, db);
  try {
    await saveImportFile(batch.id, "csv", input.bytes);
    if (account.institutionId && (await tryTemplate(viewer, batch.id, input.bytes, account.institutionId, today, db))) {
      return { status: "review", batchId: batch.id };
    }
  } catch (e) {
    await failImportBatch(viewer, batch.id, e instanceof DomainError ? e.message : CSV_MESSAGES.notCsv, db).catch(() => {});
    await deleteImportFile(batch.id);
    throw e;
  }
  return { status: "mapping", batchId: batch.id };
}

export interface CsvMappingContext {
  batchId: string;
  accountId: string;
  accountName: string;
  institutionId: string | null;
  institutionName: string | null;
  status: "parsing" | "review";
  bytes: Buffer;
}

/** Batch CSV yang masih bisa dipetakan (belum committed atau gagal) beserta file mentahnya. */
export async function loadCsvMappingContext(viewer: Viewer, batchId: string, db: DbOrTx = defaultDb): Promise<CsvMappingContext | null> {
  const batch = await getImportBatch(viewer, batchId, db);
  if (!batch) return null;
  if (batch.format !== "csv" || (batch.status !== "parsing" && batch.status !== "review")) throw new DomainError("import_not_mappable", CSV_MESSAGES.notMapping);
  const bytes = await readImportFile(batchId, "csv");
  if (!bytes) throw new DomainError("import_file_missing", CSV_MESSAGES.fileGone);
  const account = await getAccount(batch.accountId, db);
  return {
    batchId,
    accountId: batch.accountId,
    accountName: batch.accountName,
    institutionId: account.institutionId,
    institutionName: batch.institutionName ?? account.institutionName,
    status: batch.status,
    bytes,
  };
}

/** Terapkan pemetaan dari langkah pemetaan; baris dan templat disimpan dalam satu transaksi database. */
export async function applyCsvMapping(
  viewer: Viewer,
  input: { batchId: string; mapping: unknown; saveTemplate: boolean },
  opts: { today?: string } = {},
  db: DbOrTx = defaultDb,
): Promise<{ batchId: string; count: number }> {
  const ctx = await loadCsvMappingContext(viewer, input.batchId, db);
  if (!ctx) throw new DomainError("not_found", CSV_MESSAGES.notMapping);
  const parsed = csvMappingSchema.safeParse(input.mapping);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? CSV_MESSAGES.noRows);
  const mapping = parsed.data;
  let result: CsvParseResult;
  try {
    result = parseWithMapping(ctx.bytes, mapping, opts.today ?? todayJakarta());
  } catch (e) {
    if (e instanceof CsvMappingError) throw new ValidationError(e.message);
    throw e;
  }
  if (result.rows.length === 0) throw new ValidationError(CSV_MESSAGES.noRows);
  const institutionId = ctx.institutionId;
  const { count } = await db.transaction(async (tx) => {
    const saved = await saveParsedRows(viewer, ctx.batchId, result.rows, tx);
    if (input.saveTemplate && institutionId) await saveImportTemplate(viewer, { institutionId, mapping }, tx);
    return saved;
  });
  return { batchId: ctx.batchId, count };
}
