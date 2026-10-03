import { formatCountdown, formatShortDate, todayJakarta } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { loadViewerForUser } from "@/server/jobs/viewer";
import { monthStartKey, startOfKey } from "@/server/metrics/_time";
import { notifyOnce } from "@/server/mutations/job-notifications";
import { dispatchNotificationPush } from "@/server/push/dispatch";
import { listBills } from "@/server/queries/bills";
import { listBudgets } from "@/server/queries/budgets";
import { listHouseholdUserIds } from "@/server/queries/recurring";

export const JOB_DUE_NOTIFICATIONS = "notifications.due";

// F-NOT-1: tagihan jatuh tempo 3 hari lagi; hari 0-2 ikut supaya worker yang sempat mati tidak melewatkannya
export const BILL_DUE_DAYS = 3;

/**
 * 08.00 WIB: notifikasi bill_due dan budget_over (F-NOT-1). Satu notifikasi per tagihan per jatuh tempo
 * dan per anggaran per bulan; data Bersama ke kedua pengguna.
 */
export async function handleDueNotificationsJob(
  opts: { now?: Date; db?: DbOrTx; push?: boolean } = {},
): Promise<{ billDue: number; budgetOver: number }> {
  const db = opts.db ?? defaultDb;
  const today = todayJakarta(opts.now ?? new Date());
  const userIds = await listHouseholdUserIds(db);
  const viewer = userIds[0] ? await loadViewerForUser(userIds[0], db) : null;
  if (!viewer) return { billDue: 0, budgetOver: 0 };
  const recipients = (ownerId: string | null) => (ownerId ? [ownerId] : userIds);
  const sentIds: string[] = [];

  const bills = await listBills(viewer, "all", { today }, db);
  let billDue = 0;
  for (const bill of bills) {
    if (bill.daysUntilDue < 0 || bill.daysUntilDue > BILL_DUE_DAYS || bill.amount <= 0n) continue;
    const sent = await notifyOnce(db, {
      recipientIds: recipients(bill.ownerId),
      kind: "bill_due",
      payload: {
        dedupeKey: `bill_due:${bill.id}:${bill.nextDueOn}`,
        message: `Tagihan ${bill.name} ${formatRupiah(bill.amount)} jatuh tempo ${formatCountdown(bill.daysUntilDue)}, ${formatShortDate(startOfKey(bill.nextDueOn))}.`,
        entity: "bills",
        entityId: bill.id,
        dueOn: bill.nextDueOn,
      },
    });
    billDue += sent.length;
    sentIds.push(...sent.map((n) => n.id));
  }

  const month = monthStartKey(today);
  const budgets = await listBudgets(viewer, "all", { month, today }, db);
  let budgetOver = 0;
  for (const budget of budgets) {
    if (!budget.isMandatory || budget.status.value.state !== "over") continue;
    const sent = await notifyOnce(db, {
      recipientIds: recipients(budget.ownerId),
      kind: "budget_over",
      payload: {
        dedupeKey: `budget_over:${budget.id}:${month}`,
        message: `Anggaran wajib ${budget.categoryName} lewat ${formatRupiah(budget.spent - budget.amount)} dari ${formatRupiah(budget.amount)}.`,
        entity: "budgets",
        entityId: budget.id,
        month,
      },
    });
    budgetOver += sent.length;
    sentIds.push(...sent.map((n) => n.id));
  }

  if (opts.push !== false) await dispatchNotificationPush(sentIds, { db });
  return { billDue, budgetOver };
}
