import { desc, eq, isNotNull } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { importTemplates, institutions } from "@/server/db/schema";
import { readStoredMapping } from "@/server/import/csv/mapping-schema";
import type { CsvMapping } from "@/server/import/types";

export interface ImportTemplate {
  id: string;
  institutionId: string;
  institutionName: string;
  name: string;
  mapping: CsvMapping;
  version: number;
  updatedAt: Date;
}

/** Templat CSV untuk satu institusi (yang terbaru bila lebih dari satu); null kalau belum ada atau rusak. */
export async function getImportTemplateForInstitution(institutionId: string, db: DbOrTx = defaultDb): Promise<ImportTemplate | null> {
  const rows = await db
    .select({
      id: importTemplates.id,
      institutionId: importTemplates.institutionId,
      institutionName: institutions.name,
      name: importTemplates.name,
      mapping: importTemplates.mapping,
      version: importTemplates.version,
      updatedAt: importTemplates.updatedAt,
    })
    .from(importTemplates)
    .innerJoin(institutions, eq(institutions.id, importTemplates.institutionId))
    .where(eq(importTemplates.institutionId, institutionId))
    .orderBy(desc(importTemplates.updatedAt))
    .limit(1);
  const row = rows[0];
  if (!row || !row.institutionId) return null;
  const mapping = readStoredMapping(row.mapping);
  return mapping ? { ...row, institutionId: row.institutionId, mapping } : null;
}

/** Id institusi yang sudah punya templat, untuk petunjuk di halaman unggah. */
export async function listTemplateInstitutionIds(db: DbOrTx = defaultDb): Promise<string[]> {
  const rows = await db.selectDistinct({ id: importTemplates.institutionId }).from(importTemplates).where(isNotNull(importTemplates.institutionId));
  return rows.flatMap((r) => (r.id ? [r.id] : []));
}
