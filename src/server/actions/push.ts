"use server";

import { requireViewer } from "@/server/auth/session";
import { deletePushSubscription, savePushSubscription, type PushSubscriptionInput } from "@/server/mutations/push-subscriptions";
import { isPushConfigured } from "@/server/push/config";
import { DomainError } from "@/server/errors";
import { toActionError, type ActionResult } from "./result";

const NOT_CONFIGURED = "Notifikasi perangkat belum disiapkan di server ini.";

// tanpa runAction: langganan perangkat tidak mengubah tampilan halaman mana pun, jadi tidak perlu revalidasi
export async function subscribePushAction(input: PushSubscriptionInput): Promise<ActionResult<{ saved: true }>> {
  const viewer = await requireViewer();
  try {
    if (!isPushConfigured()) throw new DomainError("push_not_configured", NOT_CONFIGURED);
    await savePushSubscription(viewer, input);
    return { ok: true, data: { saved: true } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult<{ removed: number }>> {
  const viewer = await requireViewer();
  try {
    return { ok: true, data: { removed: await deletePushSubscription(viewer, { endpoint }) } };
  } catch (e) {
    return toActionError(e);
  }
}
