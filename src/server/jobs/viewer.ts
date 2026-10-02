import { asc, eq, ne } from "drizzle-orm";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { users } from "@/server/db/schema";

/** Viewer untuk job latar belakang: bertindak atas nama pengguna yang memulai pekerjaan itu. */
export async function loadViewerForUser(userId: string, db: DbOrTx = defaultDb): Promise<Viewer | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const [partner] = await db.select().from(users).where(ne(users.id, userId)).orderBy(asc(users.createdAt)).limit(1);
  return { user, partner: partner ?? null, sessionId: "worker" };
}
