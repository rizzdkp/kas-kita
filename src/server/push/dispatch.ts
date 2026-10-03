import { inArray, sql as rawSql } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { notifications, users } from "@/server/db/schema";
import { buildPushMessage } from "./payload";
import { sendPushToUser, type PushResult, type PushTransport } from "./send";
import type { VapidConfig } from "./config";

/** Kanal LISTEN/NOTIFY untuk push; NOTIFY di dalam transaksi hanya terkirim setelah commit. */
export const PUSH_CHANNEL = "kaskita_push";

const idsSchema = z.array(z.uuid()).min(1).max(50);

/**
 * Tandai notifikasi baru untuk dikirim sebagai push. Dipanggil di dalam transaksi mutasi:
 * Postgres menahan NOTIFY sampai commit dan membuangnya saat rollback, jadi push tidak pernah
 * terkirim untuk data yang batal disimpan, dan pengiriman berjalan di luar transaksi.
 */
export async function announceNotifications(tx: Tx | DbOrTx, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.execute(rawSql`select pg_notify(${PUSH_CHANNEL}, ${ids.join(",")})`);
}

export function parseAnnouncement(payload: string): string[] | null {
  const parsed = idsSchema.safeParse(payload.split(",").filter(Boolean));
  return parsed.success ? parsed.data : null;
}

export interface DispatchDeps {
  db?: DbOrTx;
  transport?: PushTransport;
  vapid?: VapidConfig | null;
}

/** Kirim push untuk notifikasi yang sudah tersimpan. Tidak pernah melempar. */
export async function dispatchNotificationPush(ids: string[], deps: DispatchDeps = {}): Promise<PushResult> {
  const total: PushResult = { sent: 0, removed: 0, failed: 0 };
  if (ids.length === 0) return total;
  const db = deps.db ?? defaultDb;
  try {
    const rows = await db
      .select({ id: notifications.id, kind: notifications.kind, payload: notifications.payload, recipientId: notifications.recipientId })
      .from(notifications)
      .where(inArray(notifications.id, ids));
    // hanya dua pengguna: nama partner penerima = nama user lain
    const people = await db.select({ id: users.id, displayName: users.displayName }).from(users);
    for (const row of rows) {
      const partnerName = people.find((p) => p.id !== row.recipientId)?.displayName ?? null;
      const result = await sendPushToUser(row.recipientId, buildPushMessage(row, partnerName), { ...deps, db });
      total.sent += result.sent;
      total.removed += result.removed;
      total.failed += result.failed;
    }
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "push_dispatch_failed", errorName: e instanceof Error ? e.name : typeof e }));
  }
  return total;
}
