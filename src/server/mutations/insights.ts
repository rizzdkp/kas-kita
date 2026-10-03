import { and, eq } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { insights } from "@/server/db/schema";
import type { ComposedInsight } from "@/server/insights/compose";
import { publishChange } from "@/server/realtime/publish";

/**
 * Ganti wawasan satu cakupan untuk satu minggu (job boleh diulang tanpa duplikat).
 * Wawasan dibuat sistem tanpa aktor dan tanpa versi, jadi tidak ditulis ke audit_log.
 */
export async function replaceWeeklyInsights(
  scopeKey: string,
  weekStart: string,
  items: ComposedInsight[],
  db: DbOrTx = defaultDb,
): Promise<string[]> {
  return db.transaction(async (tx) => {
    await tx.delete(insights).where(and(eq(insights.scope, scopeKey), eq(insights.weekStart, weekStart)));
    if (items.length === 0) return [];
    const rows = await tx
      .insert(insights)
      .values(
        items.map((i) => ({
          scope: scopeKey,
          weekStart,
          facts: i.fact,
          text: i.text,
          sourceTransactionIds: i.sourceTransactionIds,
          generatedBy: i.generatedBy,
        })),
      )
      .returning({ id: insights.id });
    await publishChange(tx, "insights", rows[0]!.id);
    return rows.map((r) => r.id);
  });
}

/** Hapus wawasan satu minggu untuk kunci cakupan tertentu (pembersihan tes e2e). */
export async function deleteWeeklyInsights(scopeKeys: string[], weekStart: string, db: DbOrTx = defaultDb): Promise<number> {
  let removed = 0;
  for (const key of scopeKeys) {
    const rows = await db
      .delete(insights)
      .where(and(eq(insights.scope, key), eq(insights.weekStart, weekStart)))
      .returning({ id: insights.id });
    removed += rows.length;
  }
  return removed;
}
