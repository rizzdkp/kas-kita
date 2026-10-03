import { and, eq, isNull, lte } from "drizzle-orm";
import { formatShortDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { recurringRules, transactions } from "@/server/db/schema";
import { InsufficientBalanceError } from "@/server/errors";
import { loadViewerForUser } from "@/server/jobs/viewer";
import { startOfKey } from "@/server/metrics/_time";
import { listHouseholdUserIds } from "@/server/queries/recurring";
import { dueRuns } from "@/server/recurring/schedule";
import { parseTemplate, templateAmount, type RecurringTemplate } from "@/server/recurring/template";
import { inTransaction } from "./_shared";
import { notifyOnce, type SentNotification } from "./job-notifications";
import { advanceRecurringRule, recurringRuleLabel } from "./recurring";
import { accountOwners } from "./transaction-input";
import { createTransaction, type TransactionRow } from "./transactions";

export type RecurringRunResult =
  | { status: "skipped" }
  | { status: "invalid"; ruleId: string }
  | { status: "done"; ruleId: string; created: TransactionRow[]; nextRunOn: string; skipped: number; notifications: SentNotification[] };

/** client_id deterministik: job yang diulang untuk tanggal yang sama tidak menggandakan transaksi. */
export function recurringClientId(ruleId: string, date: string): string {
  return `recurring:${ruleId}:${date}`;
}

async function existsByClientId(tx: Tx, clientId: string): Promise<boolean> {
  const [row] = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.clientId, clientId));
  return row !== undefined;
}

async function recipientsFor(tx: Tx, template: RecurringTemplate): Promise<{ ids: string[]; shared: boolean }> {
  const owner = (await accountOwners(tx, [template.accountId])).get(template.accountId) ?? null;
  if (owner) return { ids: [owner], shared: false };
  return { ids: await listHouseholdUserIds(tx), shared: true };
}

function pendingMessage(label: string, drafts: TransactionRow[]): string {
  const first = drafts[0];
  if (drafts.length === 1 && first) {
    return `Transaksi berulang ${label} ${formatRupiah(first.amount)}, ${formatShortDate(first.occurredAt)}, menunggu konfirmasi.`;
  }
  return `${drafts.length} transaksi berulang ${label} menunggu konfirmasi.`;
}

/**
 * Buat transaksi untuk semua periode jadwal yang jatuh sampai `today` (F-IN-7 AC1), lalu majukan next_run_on.
 * Draf memicu notifikasi recurring_pending ke pemilik akun; akun Bersama ke keduanya.
 */
export async function runRecurringRule(ruleId: string, today: string, db: DbOrTx = defaultDb): Promise<RecurringRunResult> {
  return inTransaction(db, async (tx) => {
    // skip locked: dua worker yang kebetulan jalan bersamaan tidak memproses jadwal yang sama
    const [rule] = await tx
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.id, ruleId), isNull(recurringRules.deletedAt), lte(recurringRules.nextRunOn, today)))
      .for("update", { skipLocked: true });
    if (!rule) return { status: "skipped" };
    const template = parseTemplate(rule.template);
    const viewer = template ? await loadViewerForUser(rule.createdBy, tx) : null;
    if (!template || !viewer) return { status: "invalid", ruleId };

    const { dates, next, skipped } = dueRuns(rule.rrule, rule.nextRunOn, today);
    const created: TransactionRow[] = [];
    for (const date of dates) {
      const clientId = recurringClientId(rule.id, date);
      if (await existsByClientId(tx, clientId)) continue;
      const input = {
        kind: template.kind,
        amount: templateAmount(template),
        accountId: template.accountId,
        toAccountId: template.toAccountId,
        categoryId: template.categoryId,
        note: template.note,
        beneficiary: template.beneficiary,
        tagNames: template.tagNames,
        occurredAt: startOfKey(date),
        source: "recurring" as const,
        recurringId: rule.id,
        clientId,
        status: rule.autoConfirm ? ("confirmed" as const) : ("draft" as const),
      };
      try {
        created.push(await createTransaction(viewer, input, tx));
      } catch (e) {
        // auto-konfirmasi yang membuat saldo tunai negatif turun jadi draf supaya pengguna yang memutuskan
        if (!(e instanceof InsufficientBalanceError) || input.status !== "confirmed") throw e;
        created.push(await createTransaction(viewer, { ...input, status: "draft" }, tx));
      }
    }
    await advanceRecurringRule(tx, rule, next);

    const drafts = created.filter((t) => t.status === "draft");
    let notifications: SentNotification[] = [];
    const last = drafts.at(-1);
    if (last) {
      const label = await recurringRuleLabel(tx, template);
      const to = await recipientsFor(tx, template);
      notifications = await notifyOnce(tx, {
        recipientIds: to.ids,
        kind: "recurring_pending",
        payload: {
          dedupeKey: `recurring_pending:${rule.id}:${dates.at(-1) ?? today}`,
          message: pendingMessage(label, drafts),
          href: to.shared ? "/transaksi?status=draft&scope=all" : "/transaksi?status=draft",
          entity: "transactions",
          entityId: last.id,
          ruleId: rule.id,
          count: drafts.length,
        },
      });
    }
    return { status: "done", ruleId: rule.id, created, nextRunOn: next, skipped, notifications };
  });
}
