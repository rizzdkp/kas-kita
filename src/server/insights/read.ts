import type { Scope } from "@/lib/scope";
import type { Insight } from "@/components/dashboard/insight-templates";
import { transactionHref } from "@/components/reports/transaction-link";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { listStoredInsights } from "@/server/queries/insights";
import { compareFactKinds, insightFactSchema, MAX_WEEKLY_INSIGHTS, type InsightFactKind } from "./facts";
import { insightScopeKey } from "./scope-key";
import { summarizedWeekStart } from "./week";

/**
 * Wawasan tersimpan dari job Senin untuk cakupan viewer; null kalau job belum menulis baris
 * minggu ini sehingga dashboard menghitung templat langsung.
 */
export async function getStoredInsights(viewer: Viewer, scope: Scope, today: string, db: DbOrTx = defaultDb): Promise<Insight[] | null> {
  const key = insightScopeKey(viewer, scope);
  if (!key) return null;
  const rows = await listStoredInsights(key, summarizedWeekStart(today), db);
  if (rows.length === 0) return null;
  const items: Array<Insight & { kind: InsightFactKind | null }> = rows.map((row) => {
    const parsed = insightFactSchema.safeParse(row.facts);
    // fakta lama yang tidak terbaca tetap tampil; tautannya ke daftar transaksi cakupan itu
    const link = parsed.success ? parsed.data.link : {};
    return {
      key: row.id,
      text: row.text,
      href: transactionHref({ scope, ...link }),
      kind: parsed.success ? parsed.data.kind : null,
    };
  });
  return items
    .sort((a, b) => (a.kind && b.kind ? compareFactKinds(a.kind, b.kind) : 0))
    .slice(0, MAX_WEEKLY_INSIGHTS)
    .map(({ key: k, text, href }) => ({ key: k, text, href }));
}
