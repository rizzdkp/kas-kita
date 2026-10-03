import { todayJakarta } from "@/lib/dates";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { loadViewerForUser } from "@/server/jobs/viewer";
import { monthStartKey } from "@/server/metrics/_time";
import { copyBudgetsFromPreviousMonth } from "@/server/mutations/budget-copy";
import { budgetOwnerKey } from "@/server/queries/scope";
import { listHouseholdUserIds } from "@/server/queries/recurring";

export const JOB_BUDGET_COPY = "budgets.copy-month";

/**
 * Tanggal 1, 00.05 WIB: salin anggaran bulan lalu ke bulan ini untuk setiap pemilik (Saya, Partner, Bersama).
 * Anggaran yang sudah diisi tidak ditimpa, jadi job aman diulang. Audit atas nama pemilik anggaran;
 * anggaran Bersama atas nama pengguna pertama.
 */
export async function handleBudgetCopyJob(opts: { now?: Date; db?: DbOrTx } = {}): Promise<{ copied: number }> {
  const db = opts.db ?? defaultDb;
  const month = monthStartKey(todayJakarta(opts.now ?? new Date()));
  const userIds = await listHouseholdUserIds(db);
  let copied = 0;
  for (const owner of [...userIds, null]) {
    const actorId = owner ?? userIds[0];
    const viewer = actorId ? await loadViewerForUser(actorId, db) : null;
    if (!viewer) continue;
    const result = await copyBudgetsFromPreviousMonth(viewer, { month, scopeOwners: [budgetOwnerKey(owner)] }, db);
    copied += result.copied;
  }
  return { copied };
}
