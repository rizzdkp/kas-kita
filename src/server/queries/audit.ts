import { and, desc, eq } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { auditLog, users } from "@/server/db/schema";

export type AuditValue = string | number | boolean | null | AuditValue[] | { [k: string]: AuditValue };

export interface HistoryChange {
  field: string;
  before: AuditValue;
  after: AuditValue;
}

export interface HistoryEntry {
  id: string;
  at: Date;
  action: "insert" | "update" | "delete" | "restore";
  actorId: string;
  actorName: string;
  changes: HistoryChange[];
}

/** Nominal di diff tersimpan sebagai string desimal karena bigint tidak bisa masuk JSON. */
export function parseDiff(diff: unknown): HistoryChange[] {
  if (!diff || typeof diff !== "object") return [];
  return Object.entries(diff as Record<string, unknown>).flatMap(([field, pair]) =>
    Array.isArray(pair) && pair.length === 2 ? [{ field, before: pair[0] as AuditValue, after: pair[1] as AuditValue }] : [],
  );
}

/** Riwayat edit satu entitas, terbaru dulu (F-HIST-2). */
export async function getHistory(entity: string, entityId: string, db: DbOrTx = defaultDb): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      action: auditLog.action,
      actorId: auditLog.actorId,
      actorName: users.displayName,
      diff: auditLog.diff,
    })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorId))
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.at), desc(auditLog.id));
  return rows.map(({ diff, ...r }) => ({ ...r, changes: parseDiff(diff) }));
}
