import { todayJakarta } from "@/lib/dates";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { runRecurringRule } from "@/server/mutations/recurring-drafts";
import { dispatchNotificationPush } from "@/server/push/dispatch";
import { listDueRecurringRuleIds } from "@/server/queries/recurring";
import { errorName, logEvent } from "../log";

export const JOB_RECURRING_DRAFTS = "recurring.create-drafts";

export interface RecurringJobResult {
  rules: number;
  created: number;
  drafts: number;
  skippedPeriods: number;
  invalid: number;
  failed: number;
}

/**
 * Job harian 00.10 WIB (F-IN-7): buat transaksi dari jadwal yang jatuh sampai hari ini.
 * Satu jadwal satu transaksi database, jadi satu jadwal rusak tidak menghentikan yang lain.
 */
export async function handleRecurringDraftsJob(
  opts: { now?: Date; db?: DbOrTx; ruleIds?: string[]; push?: boolean } = {},
): Promise<RecurringJobResult> {
  const db = opts.db ?? defaultDb;
  const today = todayJakarta(opts.now ?? new Date());
  const ids = await listDueRecurringRuleIds(today, db, opts.ruleIds);
  const result: RecurringJobResult = { rules: 0, created: 0, drafts: 0, skippedPeriods: 0, invalid: 0, failed: 0 };
  const notificationIds: string[] = [];
  for (const id of ids) {
    try {
      const run = await runRecurringRule(id, today, db);
      if (run.status === "invalid") {
        result.invalid += 1;
        logEvent("error", "recurring_rule_invalid", { ruleId: id });
      } else if (run.status === "done") {
        result.rules += 1;
        result.created += run.created.length;
        result.drafts += run.created.filter((t) => t.status === "draft").length;
        result.skippedPeriods += run.skipped;
        notificationIds.push(...run.notifications.map((n) => n.id));
      }
    } catch (e) {
      result.failed += 1;
      // pesan error bisa memuat isi transaksi; yang dicatat hanya jenisnya
      logEvent("error", "recurring_rule_failed", { ruleId: id, errorName: errorName(e) });
    }
  }
  if (opts.push !== false) await dispatchNotificationPush(notificationIds, { db });
  return result;
}
