import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { categories, transactions } from "@/server/db/schema";
import { DomainError, NotFoundError, ValidationError } from "@/server/errors";
import { inTransaction, parseInput, versionSchema, pickProvided } from "./_shared";
import { insertWithAudit, softDeleteWithAudit, updateWithAudit } from "./audit";

export type CategoryRow = typeof categories.$inferSelect;

const categoryFieldsSchema = z.object({
  name: z.string().trim().min(1, "Isi nama kategori").max(60),
  kind: z.enum(["income", "expense"]),
  parentId: z.uuid().nullish().transform((v) => v ?? null),
  // nama ikon Lucide kebab-case (DESIGN.md bagian 9)
  icon: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).default("circle"),
  sortOrder: z.number().int().default(0),
});

async function assertParent(tx: Tx, parentId: string | null, kind: string, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new ValidationError("Kategori tidak bisa jadi induk dirinya sendiri");
  const [parent] = await tx.select().from(categories).where(eq(categories.id, parentId));
  if (!parent) throw new NotFoundError("kategori", parentId);
  if (parent.parentId) throw new ValidationError("Kategori maksimal dua tingkat", { parentId: ["Pilih kategori utama"] });
  if (parent.kind !== kind) throw new ValidationError("Jenis subkategori harus sama dengan induknya", { parentId: ["Jenis berbeda"] });
}

async function loadEditable(tx: Tx, id: string): Promise<CategoryRow> {
  const [row] = await tx.select().from(categories).where(eq(categories.id, id));
  if (!row) throw new NotFoundError("kategori", id);
  if (row.isSystem) throw new DomainError("system_category", "Kategori sistem tidak bisa diubah atau dihapus.");
  return row;
}

export async function createCategory(viewer: Viewer, input: z.input<typeof categoryFieldsSchema>, db: DbOrTx = defaultDb): Promise<CategoryRow> {
  const data = parseInput(categoryFieldsSchema, input);
  return inTransaction(db, async (tx) => {
    await assertParent(tx, data.parentId, data.kind);
    return insertWithAudit(tx, categories, data, viewer.user.id);
  });
}

const updateCategorySchema = z.object({ id: z.uuid(), version: versionSchema, patch: categoryFieldsSchema.partial() });

export async function updateCategory(viewer: Viewer, input: z.input<typeof updateCategorySchema>, db: DbOrTx = defaultDb): Promise<CategoryRow> {
  const parsed = parseInput(updateCategorySchema, input);
  const { id, version } = parsed;
  const patch = pickProvided(parsed.patch, (input as { patch?: unknown }).patch);
  return inTransaction(db, async (tx) => {
    const current = await loadEditable(tx, id);
    const merged = { ...current, ...patch };
    await assertParent(tx, merged.parentId, merged.kind, id);
    if (patch.kind && patch.kind !== current.kind) {
      const [used] = await tx.select({ n: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.categoryId, id));
      if ((used?.n ?? 0) > 0) throw new ValidationError("Jenis kategori yang sudah dipakai transaksi tidak bisa diganti");
    }
    return (await updateWithAudit(tx, categories, { id, expectedVersion: version, actorId: viewer.user.id, values: patch })).after;
  });
}

export async function archiveCategory(
  viewer: Viewer,
  input: { id: string; version: number; archived?: boolean },
  db: DbOrTx = defaultDb,
): Promise<CategoryRow> {
  const { id, version, archived } = parseInput(
    z.object({ id: z.uuid(), version: versionSchema, archived: z.boolean().default(true) }),
    input,
  );
  return inTransaction(db, async (tx) => {
    await loadEditable(tx, id);
    const values = { archivedAt: archived ? new Date() : null };
    return (await updateWithAudit(tx, categories, { id, expectedVersion: version, actorId: viewer.user.id, values })).after;
  });
}

/** Hapus hanya kategori yang belum pernah dipakai; yang sudah dipakai diarsipkan. */
export async function deleteCategory(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<CategoryRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    await loadEditable(tx, id);
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(or(eq(categories.id, id), and(eq(categories.parentId, id), isNull(categories.deletedAt))));
    if ((used?.n ?? 0) > 0) {
      throw new DomainError("category_in_use", "Kategori ini sudah dipakai transaksi. Arsipkan supaya riwayatnya tetap ada.");
    }
    return (await softDeleteWithAudit(tx, categories, { id, expectedVersion: version, actorId: viewer.user.id })).after;
  });
}
