import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";

// satu kanal untuk semua perubahan; payload hanya nama entitas dan id, tanpa isi data (SECURITY, AGENTS aturan 5)
export const CHANGES_CHANNEL = "kaskita_changes";

export interface ChangeEvent {
  entity: string;
  id: string;
}

/**
 * NOTIFY di dalam transaksi baru dikirim Postgres saat commit dan dibuang saat rollback,
 * jadi aman dipanggil dari tengah mutasi (ARCHITECTURE 8).
 */
export async function publishChange(db: DbOrTx, entity: string, id: string): Promise<void> {
  const payload = JSON.stringify({ entity, id } satisfies ChangeEvent);
  await db.execute(sql`select pg_notify(${CHANGES_CHANNEL}, ${payload})`);
}
