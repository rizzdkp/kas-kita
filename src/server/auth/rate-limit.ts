import { and, count, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db/client";
import { loginAttempts } from "@/server/db/schema";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

export interface LoginIdentity {
  ip: string | null;
  email?: string | null;
}

export interface LoginLock {
  lockedUntil: Date;
}

// kunci per IP dan per email; baris "lock:" menandai awal penguncian supaya tahan restart
export function attemptKeys({ ip, email }: LoginIdentity): string[] {
  const keys = [`ip:${ip ?? "unknown"}`];
  const normalized = email?.trim().toLowerCase();
  if (normalized) keys.push(`email:${normalized}`);
  return keys;
}

const lockKey = (key: string) => `lock:${key}`;

export async function getLoginLock(identity: LoginIdentity, now: Date = new Date(), dbx: DbOrTx = db): Promise<LoginLock | null> {
  const keys = attemptKeys(identity).map(lockKey);
  const [latest] = await dbx
    .select({ at: loginAttempts.at })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.key, keys), gt(loginAttempts.at, new Date(now.getTime() - LOGIN_LOCK_MS))))
    .orderBy(desc(loginAttempts.at))
    .limit(1);
  return latest ? { lockedUntil: new Date(latest.at.getTime() + LOGIN_LOCK_MS) } : null;
}

export async function recordFailedLogin(identity: LoginIdentity, now: Date = new Date(), dbx: DbOrTx = db): Promise<LoginLock | null> {
  const keys = attemptKeys(identity);
  return dbx.transaction(async (tx) => {
    await tx.delete(loginAttempts).where(lt(loginAttempts.at, new Date(now.getTime() - RETENTION_MS)));
    await tx.insert(loginAttempts).values(keys.map((key) => ({ key, at: now })));
    const windowStart = new Date(now.getTime() - LOGIN_WINDOW_MS);
    const counts = await tx
      .select({ key: loginAttempts.key, failures: count() })
      .from(loginAttempts)
      .where(and(inArray(loginAttempts.key, keys), gt(loginAttempts.at, windowStart)))
      .groupBy(loginAttempts.key);
    const exceeded = counts.filter((c) => c.failures >= LOGIN_MAX_FAILURES).map((c) => c.key);
    if (exceeded.length === 0) return null;
    await tx.insert(loginAttempts).values(exceeded.map((key) => ({ key: lockKey(key), at: now })));
    // kegagalan lama dibuang supaya hitungan mulai dari nol setelah kunci berakhir
    await tx.delete(loginAttempts).where(and(inArray(loginAttempts.key, exceeded), sql`${loginAttempts.at} <= ${now}`));
    return { lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MS) };
  });
}

// login berhasil menghapus hitungan kegagalan email, bukan IP, supaya penebak dari IP yang sama tetap terhitung
export async function clearFailedLogins(email: string, dbx: DbOrTx = db): Promise<void> {
  const [emailKey] = attemptKeys({ ip: null, email }).slice(1);
  if (emailKey) await dbx.delete(loginAttempts).where(eq(loginAttempts.key, emailKey));
}

export function lockMessage(lock: LoginLock, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.ceil((lock.lockedUntil.getTime() - now.getTime()) / 60_000));
  return `Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam ${minutes} menit.`;
}
