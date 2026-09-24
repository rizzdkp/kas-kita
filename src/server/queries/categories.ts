import { and, asc, eq, isNull } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { categories } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";

export type CategoryRow = typeof categories.$inferSelect;
export type SystemCategoryKey = "adjustment" | "transfer";

export interface CategoryNode extends CategoryRow {
  children: CategoryRow[];
}

/** Pohon dua tingkat: induk dengan anak-anaknya, urut sort_order lalu nama. */
export async function listCategories(
  opts: { kind?: "income" | "expense" | "system"; includeArchived?: boolean } = {},
  db: DbOrTx = defaultDb,
): Promise<CategoryNode[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(
      and(
        isNull(categories.deletedAt),
        opts.kind ? eq(categories.kind, opts.kind) : undefined,
        opts.includeArchived ? undefined : isNull(categories.archivedAt),
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const roots = rows.filter((r) => !r.parentId || !rows.some((p) => p.id === r.parentId));
  return roots.map((r) => ({ ...r, children: rows.filter((c) => c.parentId === r.id) }));
}

export async function getCategory(id: string, db: DbOrTx = defaultDb): Promise<CategoryRow> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  if (!row) throw new NotFoundError("categories", id);
  return row;
}

export async function getSystemCategory(key: SystemCategoryKey, db: DbOrTx = defaultDb): Promise<CategoryRow> {
  const [row] = await db.select().from(categories).where(eq(categories.systemKey, key));
  if (!row) throw new NotFoundError("categories", key);
  return row;
}
