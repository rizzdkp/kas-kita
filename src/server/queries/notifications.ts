import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { notifications } from "@/server/db/schema";

export type NotificationRow = typeof notifications.$inferSelect;

export async function listNotifications(
  viewer: Viewer,
  opts: { unreadOnly?: boolean; limit?: number } = {},
  db: DbOrTx = defaultDb,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientId, viewer.user.id), opts.unreadOnly ? isNull(notifications.readAt) : undefined))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(Math.min(opts.limit ?? 30, 100));
}

export async function countUnreadNotifications(viewer: Viewer, db: DbOrTx = defaultDb): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipientId, viewer.user.id), isNull(notifications.readAt)));
  return row?.n ?? 0;
}
