import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { notifications } from "@/server/db/schema";

export type JobNotificationKind = "bill_due" | "budget_over" | "recurring_pending";

/** Payload notifikasi dari job terjadwal; `dedupeKey` mencegah notifikasi yang sama terkirim dua kali. */
export interface JobNotificationPayload {
  dedupeKey: string;
  message: string;
  href?: string;
  entity?: string;
  entityId?: string;
  [extra: string]: unknown;
}

export interface SentNotification {
  id: string;
  recipientId: string;
  kind: JobNotificationKind;
  message: string;
  href: string | null;
}

/**
 * Notifikasi F-NOT-1 dari job, sekali per penerima per `dedupeKey` (misalnya tagihan + jatuh temponya).
 * Bukan data keuangan, jadi tanpa audit; id dikembalikan supaya job meneruskannya ke web push setelah commit.
 */
export async function notifyOnce(
  db: DbOrTx,
  opts: { recipientIds: string[]; kind: JobNotificationKind; payload: JobNotificationPayload },
): Promise<SentNotification[]> {
  const recipients = [...new Set(opts.recipientIds)];
  if (recipients.length === 0) return [];
  const existing = await db
    .select({ recipientId: notifications.recipientId })
    .from(notifications)
    .where(
      and(
        eq(notifications.kind, opts.kind),
        inArray(notifications.recipientId, recipients),
        sql`${notifications.payload}->>'dedupeKey' = ${opts.payload.dedupeKey}`,
      ),
    );
  const done = new Set(existing.map((r) => r.recipientId));
  const fresh = recipients.filter((id) => !done.has(id));
  if (fresh.length === 0) return [];
  const rows = await db
    .insert(notifications)
    .values(fresh.map((recipientId) => ({ recipientId, kind: opts.kind, payload: opts.payload })))
    .returning({ id: notifications.id, recipientId: notifications.recipientId });
  return rows.map((r) => ({ ...r, kind: opts.kind, message: opts.payload.message, href: opts.payload.href ?? null }));
}
