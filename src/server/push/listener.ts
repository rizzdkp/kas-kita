import { sql } from "@/server/db/client";
import { isPushConfigured } from "./config";
import { PUSH_CHANNEL, dispatchNotificationPush, parseAnnouncement, type DispatchDeps } from "./dispatch";

type Holder = { kaskitaPushListener?: Promise<{ unlisten: () => Promise<void> }> };
const holder = globalThis as Holder;

/**
 * Dengarkan kanal push di proses app (sekali per proses). postgres-js memakai koneksi
 * tersendiri dan menyambung ulang otomatis. Tanpa VAPID tidak mendengarkan apa pun.
 */
export async function startPushListener(deps: DispatchDeps = {}): Promise<boolean> {
  if (!isPushConfigured() && deps.vapid === undefined) return false;
  holder.kaskitaPushListener ??= sql.listen(PUSH_CHANNEL, (payload) => {
    const ids = parseAnnouncement(payload);
    if (ids) void dispatchNotificationPush(ids, deps);
  });
  try {
    await holder.kaskitaPushListener;
    return true;
  } catch (e) {
    holder.kaskitaPushListener = undefined;
    console.error(JSON.stringify({ level: "error", msg: "push_listener_failed", errorName: e instanceof Error ? e.name : typeof e }));
    return false;
  }
}

/** Untuk tes: berhenti mendengarkan supaya proses bisa selesai. */
export async function stopPushListener(): Promise<void> {
  const pending = holder.kaskitaPushListener;
  holder.kaskitaPushListener = undefined;
  if (pending) await (await pending).unlisten();
}
