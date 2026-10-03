import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";
import { parseInput } from "./_shared";

// endpoint layanan push selalu https; kunci base64url dari PushSubscription.toJSON()
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(20).max(200),
    auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(8).max(100),
  }),
  userAgent: z.string().max(400).nullish(),
});

export type PushSubscriptionInput = z.input<typeof pushSubscriptionInputSchema>;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/**
 * Simpan langganan perangkat ini. Endpoint yang sama milik user lain dipindah ke viewer,
 * karena satu browser hanya punya satu langganan dan yang sedang masuk yang menerimanya.
 * Bukan data keuangan, jadi tanpa audit.
 */
export async function savePushSubscription(viewer: Viewer, input: PushSubscriptionInput, db: DbOrTx = defaultDb): Promise<PushSubscriptionRow> {
  const parsed = parseInput(pushSubscriptionInputSchema, input);
  const values = {
    userId: viewer.user.id,
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    userAgent: parsed.userAgent ?? null,
  };
  const [row] = await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: values.userId, p256dh: values.p256dh, auth: values.auth, userAgent: values.userAgent },
    })
    .returning();
  if (!row) throw new Error("langganan push tidak tersimpan");
  return row;
}

/** Hapus langganan perangkat ini milik viewer; mengembalikan jumlah baris yang terhapus. */
export async function deletePushSubscription(viewer: Viewer, input: { endpoint: string }, db: DbOrTx = defaultDb): Promise<number> {
  const { endpoint } = parseInput(z.object({ endpoint: z.string().min(1).max(2048) }), input);
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, viewer.user.id), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length;
}

/** Dipakai pengirim push saat layanan push menjawab 404/410: langganan sudah tidak berlaku. */
export async function removeExpiredPushSubscriptions(ids: string[], db: DbOrTx = defaultDb): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, ids)).returning({ id: pushSubscriptions.id });
  return rows.length;
}
