import { asc } from "drizzle-orm";
import { todayJakarta } from "@/lib/dates";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { loadViewerForUser } from "@/server/jobs/viewer";
import { replaceWeeklyInsights } from "@/server/mutations/insights";
import { collectWeeklyFacts } from "./collect";
import { loadInsightWriter } from "./ai-writer";
import { composeInsights, type InsightWriter } from "./compose";
import { ALL_SCOPE_KEY, personalScopeKey } from "./scope-key";
import { summarizedWeekStart } from "./week";

export interface WeeklyInsightsRun {
  weekStart: string;
  scopes: number;
  insights: number;
  ai: number;
  template: number;
}

export interface WeeklyInsightsOptions {
  now?: Date;
  /** Diisi tes; default memakai pengaturan AI rumah tangga, atau templat kalau belum dipasang. */
  writer?: InsightWriter | null;
}

/** Job insights.weekly: Saya untuk tiap pengguna (Partner = Saya milik pengguna lain) dan Gabungan. */
export async function runWeeklyInsights(opts: WeeklyInsightsOptions = {}, db: DbOrTx = defaultDb): Promise<WeeklyInsightsRun> {
  const today = todayJakarta(opts.now ?? new Date());
  const weekStart = summarizedWeekStart(today);
  const writer = opts.writer === undefined ? await loadInsightWriter(db) : opts.writer;

  const people = await db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt));
  const targets: Array<{ key: string; viewer: Viewer; scope: Scope }> = [];
  for (const p of people) {
    const viewer = await loadViewerForUser(p.id, db);
    if (viewer) targets.push({ key: personalScopeKey(p.id), viewer, scope: "me" });
  }
  // Gabungan hanya bermakna kalau ada dua orang; tanpa partner isinya sama dengan Saya
  const first = targets[0];
  if (first && people.length > 1) targets.push({ key: ALL_SCOPE_KEY, viewer: first.viewer, scope: "all" });

  const run: WeeklyInsightsRun = { weekStart, scopes: 0, insights: 0, ai: 0, template: 0 };
  for (const t of targets) {
    const facts = await collectWeeklyFacts(t.viewer, t.scope, { weekStart, today }, db);
    const composed = await composeInsights(facts, writer);
    await replaceWeeklyInsights(t.key, weekStart, composed, db);
    run.scopes += 1;
    run.insights += composed.length;
    for (const c of composed) run[c.generatedBy] += 1;
  }
  return run;
}
