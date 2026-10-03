import { and, asc, desc, eq, gt, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { auth } from "./auth";
import { LOGIN_PATH, SESSION_EXPIRED_PARAM } from "./constants";
import type { Viewer } from "./viewer";

export async function getViewerFromHeaders(requestHeaders: Headers): Promise<Viewer | null> {
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const [user] = await db.select().from(users).where(eq(users.id, result.user.id)).limit(1);
  if (!user) return null;
  // trigger database menjamin paling banyak dua pengguna, jadi partner adalah satu-satunya user lain
  const [partner] = await db.select().from(users).where(ne(users.id, user.id)).orderBy(asc(users.createdAt)).limit(1);
  return { user, partner: partner ?? null, sessionId: result.session.id };
}

export const getViewer = cache(async (): Promise<Viewer | null> => getViewerFromHeaders(await headers()));

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`${LOGIN_PATH}?${SESSION_EXPIRED_PARAM}=berakhir`);
  return viewer;
}

export interface ActiveSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  trusted: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export async function listSessions(viewer: Viewer, now: Date = new Date()): Promise<ActiveSession[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, viewer.user.id), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    trusted: row.trusted,
    createdAt: row.createdAt,
    lastActiveAt: row.updatedAt,
    expiresAt: row.expiresAt,
    isCurrent: row.id === viewer.sessionId,
  }));
}

// hanya sesi milik viewer yang bisa dicabut; mengembalikan false kalau sesi tidak ditemukan
export async function revokeSession(viewer: Viewer, sessionId: string): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, viewer.user.id)))
    .returning({ id: sessions.id });
  return deleted.length > 0;
}
