import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/server/db/schema";

function loadTestUrl(): string {
  if (!process.env.TEST_DATABASE_URL) {
    try {
      const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
      const line = env.split("\n").find((l) => l.startsWith("TEST_DATABASE_URL="));
      if (line) process.env.TEST_DATABASE_URL = line.slice("TEST_DATABASE_URL=".length).trim();
    } catch {
      // tanpa .env.local, TEST_DATABASE_URL wajib diset di environment
    }
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL belum diisi");
  // pengaman: tes mengosongkan tabel, jadi jangan pernah jalan di database dev
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL harus database tes (*_test)");
  return url;
}

const url = loadTestUrl();
// client global membaca DATABASE_URL saat import; arahkan ke DB tes supaya tidak pernah menyentuh dev
process.env.DATABASE_URL = url;

export const testSql = postgres(url, { max: 4, onnotice: () => {}, types: { bigint: postgres.BigInt } });
export const testDb = drizzle(testSql, { schema });
export type TestDb = typeof testDb;

/** Kosongkan semua tabel data (bukan skema); TRUNCATE tidak memicu trigger append-only audit_log. */
export async function resetDb(): Promise<void> {
  const rows = (await testDb.execute(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )) as unknown as Array<{ tablename: string }>;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await testDb.execute(sql.raw(`truncate table ${list} restart identity cascade`));
}

export async function closeDb(): Promise<void> {
  await testSql.end({ timeout: 5 });
}
