import { db, type DbOrTx } from "@/server/db/client";
import { setUserPassword } from "./create-user";

export const DEV_SEED_EMAILS = ["rizz@kaskita.local", "nadia@kaskita.local"] as const;
export const DEFAULT_DEV_SEED_PASSWORD = "kaskita-dev-123";

export function devSeedPassword(env: NodeJS.ProcessEnv = process.env): string {
  return env.DEV_SEED_PASSWORD?.trim() || DEFAULT_DEV_SEED_PASSWORD;
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

// password yang diketahui umum tidak boleh pernah terpasang di server produksi
export async function setDevSeedPasswords(dbx: DbOrTx = db): Promise<string> {
  if (isProduction()) throw new Error("Password user seed tidak disetel di NODE_ENV=production.");
  const password = devSeedPassword();
  for (const email of DEV_SEED_EMAILS) await setUserPassword(email, password, { revokeSessions: false }, dbx);
  return password;
}
