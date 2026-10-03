import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";
import { removeExpiredPushSubscriptions } from "@/server/mutations/push-subscriptions";
import { getVapidConfig, type VapidConfig } from "./config";
import type { PushMessage } from "./payload";

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Kirim satu push; melempar error dengan statusCode kalau layanan push menolak. Bisa diganti di tes. */
export type PushTransport = (target: PushTarget, body: string, vapid: VapidConfig) => Promise<void>;

export interface PushResult {
  sent: number;
  removed: number;
  failed: number;
}

// notifikasi lewat dari sehari tidak berguna lagi di layar kunci
const PUSH_TTL_SECONDS = 24 * 60 * 60;

const webPushTransport: PushTransport = async (target, body, vapid) => {
  await webpush.sendNotification(target, body, {
    TTL: PUSH_TTL_SECONDS,
    urgency: "normal",
    vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
  });
};

function statusOf(e: unknown): number | null {
  if (typeof e === "object" && e !== null && "statusCode" in e && typeof (e as { statusCode: unknown }).statusCode === "number") {
    return (e as { statusCode: number }).statusCode;
  }
  return null;
}

// 404 dan 410: langganan dicabut browser; 400 dan 403 lainnya bisa karena kunci, jadi langganan dibiarkan
const GONE = new Set([404, 410]);

/**
 * Kirim push ke semua perangkat user. Tanpa VAPID tidak mengirim apa pun.
 * Tidak pernah melempar: push opsional dan tidak boleh menggagalkan alur pemanggil.
 */
export async function sendPushToUser(
  userId: string,
  message: PushMessage,
  deps: { db?: DbOrTx; transport?: PushTransport; vapid?: VapidConfig | null } = {},
): Promise<PushResult> {
  const result: PushResult = { sent: 0, removed: 0, failed: 0 };
  const vapid = deps.vapid === undefined ? getVapidConfig() : deps.vapid;
  if (!vapid) return result;
  const db = deps.db ?? defaultDb;
  const transport = deps.transport ?? webPushTransport;
  try {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    const body = JSON.stringify(message);
    const gone: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await transport({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, vapid);
          result.sent += 1;
        } catch (e) {
          const status = statusOf(e);
          if (status !== null && GONE.has(status)) gone.push(sub.id);
          else result.failed += 1;
          // isi pesan dan endpoint tidak dicatat; endpoint memuat token perangkat
          console.warn(JSON.stringify({ level: "warn", msg: "push_send_failed", status }));
        }
      }),
    );
    result.removed = await removeExpiredPushSubscriptions(gone, db);
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "push_dispatch_failed", errorName: e instanceof Error ? e.name : typeof e }));
  }
  return result;
}
