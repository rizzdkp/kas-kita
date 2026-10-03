import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { parseInput } from "./_shared";

/** Tandai dibaca; tanpa ids berarti semua notifikasi milik viewer. Bukan data keuangan, jadi tanpa audit. */
export async function markNotificationsRead(viewer: Viewer, input: { ids?: string[] } = {}, db: DbOrTx = defaultDb): Promise<number> {
  const { ids } = parseInput(z.object({ ids: z.array(z.uuid()).optional() }), input);
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, viewer.user.id),
        isNull(notifications.readAt),
        ids ? inArray(notifications.id, ids) : undefined,
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}
