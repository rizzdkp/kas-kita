import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { importTemplates, institutions } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { csvMappingSchema } from "@/server/import/csv/mapping-schema";
import { insertWithAudit, updateWithAudit } from "./audit";
import { inTransaction, parseInput } from "./_shared";

const saveTemplateSchema = z.object({
  institutionId: z.uuid(),
  mapping: csvMappingSchema,
});
export type SaveImportTemplateInput = z.input<typeof saveTemplateSchema>;
export type ImportTemplateRow = typeof importTemplates.$inferSelect;

// jsonb Postgres mengurutkan ulang kunci, jadi dibandingkan per kunci
function sameMapping(stored: unknown, next: object): boolean {
  if (!stored || typeof stored !== "object") return false;
  const old = stored as Record<string, unknown>;
  const fresh = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(old), ...Object.keys(fresh)]);
  return [...keys].every((k) => (old[k] ?? null) === (fresh[k] ?? null));
}

/**
 * Simpan pemetaan CSV sebagai templat institusi (F-IN-4 AC2). Satu templat per institusi: kalau sudah ada,
 * templat itu diperbarui dengan versi dan audit, bukan ditambah baris baru.
 */
export async function saveImportTemplate(viewer: Viewer, input: SaveImportTemplateInput, db: DbOrTx = defaultDb): Promise<ImportTemplateRow> {
  const data = parseInput(saveTemplateSchema, input);
  return inTransaction(db, async (tx) => {
    const [institution] = await tx.select({ name: institutions.name }).from(institutions).where(eq(institutions.id, data.institutionId));
    if (!institution) throw new ValidationError("Institusi tidak ditemukan", { institutionId: ["Institusi tidak ditemukan"] });
    const [existing] = await tx
      .select()
      .from(importTemplates)
      .where(eq(importTemplates.institutionId, data.institutionId))
      .orderBy(desc(importTemplates.updatedAt))
      .limit(1)
      .for("update");
    if (!existing) {
      return insertWithAudit(tx, importTemplates, { institutionId: data.institutionId, name: institution.name, mapping: data.mapping }, viewer.user.id);
    }
    if (existing.name === institution.name && sameMapping(existing.mapping, data.mapping)) return existing;
    const { after } = await updateWithAudit(tx, importTemplates, {
      id: existing.id,
      expectedVersion: existing.version,
      actorId: viewer.user.id,
      values: { name: institution.name, mapping: data.mapping },
    });
    return after;
  });
}
