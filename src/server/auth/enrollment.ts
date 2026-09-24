import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, like } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db/client";
import { users, verifications } from "@/server/db/schema";
import { ENROLL_PATH } from "./constants";
import type { UserRow } from "./viewer";

export const ENROLLMENT_TTL_MS = 30 * 60 * 1000;
const IDENTIFIER_PREFIX = "enroll:";

// yang disimpan hanya hash token, jadi isi tabel verifications tidak bisa dipakai sebagai tautan
function identifierFor(token: string): string {
  return IDENTIFIER_PREFIX + createHash("sha256").update(token).digest("hex");
}

export async function createEnrollmentToken(userId: string, now: Date = new Date(), dbx: DbOrTx = db): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await dbx.transaction(async (tx) => {
    await tx.delete(verifications).where(and(eq(verifications.value, userId), like(verifications.identifier, `${IDENTIFIER_PREFIX}%`)));
    await tx.insert(verifications).values({
      identifier: identifierFor(token),
      value: userId,
      expiresAt: new Date(now.getTime() + ENROLLMENT_TTL_MS),
    });
  });
  return token;
}

export async function findEnrollmentUser(token: string, now: Date = new Date(), dbx: DbOrTx = db): Promise<UserRow | null> {
  if (!token) return null;
  const [row] = await dbx
    .select({ user: users })
    .from(verifications)
    .innerJoin(users, eq(users.id, verifications.value))
    .where(and(eq(verifications.identifier, identifierFor(token)), gt(verifications.expiresAt, now)))
    .limit(1);
  return row?.user ?? null;
}

// hapus-lalu-kembalikan dalam satu statement supaya dua request bersamaan tidak sama-sama lolos
export async function consumeEnrollmentToken(token: string, now: Date = new Date(), dbx: DbOrTx = db): Promise<string | null> {
  if (!token) return null;
  const [row] = await dbx
    .delete(verifications)
    .where(and(eq(verifications.identifier, identifierFor(token)), gt(verifications.expiresAt, now)))
    .returning({ userId: verifications.value });
  return row?.userId ?? null;
}

export function enrollmentUrl(token: string, appUrl: string = process.env.APP_URL ?? "http://localhost:3000"): string {
  const url = new URL(ENROLL_PATH, appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
