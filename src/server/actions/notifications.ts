"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { parseInput } from "@/server/mutations/_shared";
import { markNotificationsRead } from "@/server/mutations/notifications";
import { countUnreadNotifications, listNotifications, type NotificationRow } from "@/server/queries/notifications";
import { runAction, toActionError, type ActionResult } from "./result";

export interface NotificationItem {
  id: string;
  kind: NotificationRow["kind"];
  message: string;
  href: string | null;
  createdAt: Date;
  read: boolean;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
}

const payloadSchema = z.object({
  message: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  href: z.string().startsWith("/").optional(),
});

// tujuan tautan per entitas; entitas tanpa halaman detail membuka halaman daftarnya
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  transactions: (id) => `/transaksi?id=${id}`,
  accounts: (id) => `/akun?id=${id}`,
  bills: (id) => `/tagihan?id=${id}`,
  goals: (id) => `/target?id=${id}`,
  goal_contributions: () => "/target",
  budgets: () => "/anggaran",
  categories: () => "/pengaturan#kategori",
};

// hanya ada dua pengguna, jadi pengubah data milik viewer pasti partner
function fallbackMessage(kind: NotificationRow["kind"], partnerName: string | null): string {
  if (kind === "partner_edit") return partnerName ? `${partnerName} mengubah data milikmu.` : "Ada perubahan pada data milikmu.";
  return FALLBACK_MESSAGE[kind];
}

const FALLBACK_MESSAGE: Record<Exclude<NotificationRow["kind"], "partner_edit">, string> = {
  bill_due: "Ada tagihan yang jatuh tempo 3 hari lagi.",
  budget_over: "Ada anggaran wajib yang lewat.",
  recurring_pending: "Ada transaksi berulang yang menunggu konfirmasi.",
};

function toItem(row: NotificationRow, partnerName: string | null): NotificationItem {
  const parsed = payloadSchema.safeParse(row.payload);
  const payload = parsed.success ? parsed.data : {};
  const route = payload.entity ? ENTITY_ROUTES[payload.entity] : undefined;
  const href = payload.href ?? (route && payload.entityId ? route(payload.entityId) : null);
  return {
    id: row.id,
    kind: row.kind,
    message: payload.message ?? fallbackMessage(row.kind, partnerName),
    href,
    createdAt: row.createdAt,
    read: row.readAt !== null,
  };
}

// hanya baca: tanpa runAction supaya membuka popover tidak memicu revalidasi seluruh halaman
export async function loadNotificationsAction(): Promise<ActionResult<NotificationFeed>> {
  const viewer = await requireViewer();
  try {
    const [rows, unread] = await Promise.all([listNotifications(viewer, { limit: 30 }), countUnreadNotifications(viewer)]);
    return { ok: true, data: { items: rows.map((r) => toItem(r, viewer.partner?.displayName ?? null)), unread } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Tanpa ids berarti tandai semua dibaca; mengembalikan sisa yang belum dibaca untuk titik di tombol. */
export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult<{ unread: number }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = parseInput(z.object({ ids: z.array(z.uuid()).max(100).optional() }), { ids });
    await markNotificationsRead(viewer, input);
    return { unread: await countUnreadNotifications(viewer) };
  });
}
