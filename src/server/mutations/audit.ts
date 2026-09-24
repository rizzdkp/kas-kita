import { and, desc, eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { Tx } from "@/server/db/client";
import { auditLog, users } from "@/server/db/schema";
import { ConflictError, NotFoundError } from "@/server/errors";
import type { AuditValue } from "@/server/queries/audit";

/** Tabel ber-audit: punya id dan version (DATA-MODEL aturan 4 dan 6). */
export type AuditedTable = PgTable & { id: PgColumn; version: PgColumn };
export type AuditAction = "insert" | "update" | "delete" | "restore";
export type AuditDiff = Record<string, [AuditValue, AuditValue]>;

// kolom yang berubah setiap update; mencatatnya hanya menambah noise di riwayat
const IGNORED_FIELDS = new Set(["version", "updated_at", "created_at", "updated_by"]);

export function toAuditValue(v: unknown): AuditValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(toAuditValue);
  if (typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, toAuditValue(x)]));
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

function sameValue(a: AuditValue, b: AuditValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Diff {kolom_db: [lama, baru]} memakai nama kolom database supaya stabil walau nama properti TS berubah. */
export function computeDiff(table: PgTable, before: Record<string, unknown> | null, after: Record<string, unknown>): AuditDiff {
  const columns = getTableColumns(table);
  const diff: AuditDiff = {};
  for (const [key, column] of Object.entries(columns)) {
    if (IGNORED_FIELDS.has(column.name)) continue;
    const oldValue = toAuditValue(before ? before[key] : null);
    const newValue = toAuditValue(after[key]);
    if (!sameValue(oldValue, newValue)) diff[column.name] = [oldValue, newValue];
  }
  return diff;
}

export async function writeAudit(
  tx: Tx,
  entry: { actorId: string; entity: string; entityId: string; action: AuditAction; diff: AuditDiff },
): Promise<void> {
  await tx.insert(auditLog).values(entry);
}

async function lastEditor(tx: Tx, entity: string, entityId: string): Promise<{ name: string | null; at: Date | null }> {
  const [row] = await tx
    .select({ name: users.displayName, at: auditLog.at })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorId))
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(1);
  return { name: row?.name ?? null, at: row?.at ?? null };
}

async function conflict<T extends AuditedTable>(tx: Tx, table: T, latest: T["$inferSelect"]): Promise<ConflictError<T["$inferSelect"]>> {
  const entity = getTableName(table);
  const row = latest as Record<string, unknown>;
  const editor = await lastEditor(tx, entity, String(row.id));
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : (editor.at ?? new Date());
  return new ConflictError({ entity, latest, updatedByName: editor.name, updatedAt });
}

export async function selectById<T extends AuditedTable>(tx: Tx, table: T, id: string, forUpdate = false): Promise<T["$inferSelect"] | undefined> {
  const q = tx.select().from(table as PgTable).where(eq(table.id, id));
  const rows = forUpdate ? await q.for("update") : await q;
  return rows[0] as T["$inferSelect"] | undefined;
}

export async function insertWithAudit<T extends AuditedTable>(
  tx: Tx,
  table: T,
  values: T["$inferInsert"],
  actorId: string,
  extraDiff?: AuditDiff,
): Promise<T["$inferSelect"]> {
  const [row] = (await tx.insert(table).values(values).returning()) as Array<T["$inferSelect"]>;
  const created = row as Record<string, unknown>;
  await writeAudit(tx, {
    actorId,
    entity: getTableName(table),
    entityId: String(created.id),
    action: "insert",
    diff: { ...computeDiff(table, null, created), ...extraDiff },
  });
  return row as T["$inferSelect"];
}

export interface UpdateResult<Row> {
  before: Row;
  after: Row;
  diff: AuditDiff;
}

/**
 * Update optimistik: WHERE id AND version, nol baris berarti ConflictError berisi baris terbaru.
 * `extraDiff` untuk perubahan di tabel relasi (misalnya tag) yang ikut tercatat di entitas ini.
 */
export async function updateWithAudit<T extends AuditedTable>(
  tx: Tx,
  table: T,
  opts: {
    id: string;
    expectedVersion: number;
    actorId: string;
    values: PgUpdateSetSource<T>;
    action?: Exclude<AuditAction, "insert">;
    extraDiff?: AuditDiff;
  },
): Promise<UpdateResult<T["$inferSelect"]>> {
  const entity = getTableName(table);
  const before = await selectById(tx, table, opts.id);
  if (!before) throw new NotFoundError(entity, opts.id);
  if ((before as Record<string, unknown>).version !== opts.expectedVersion) throw await conflict(tx, table, before);

  const columns = getTableColumns(table);
  const set: Record<string, unknown> = { ...opts.values, version: sql`${table.version} + 1` };
  if ("updatedAt" in columns) set.updatedAt = new Date();
  if ("updatedBy" in columns) set.updatedBy = opts.actorId;

  const rows = (await tx
    .update(table)
    .set(set as PgUpdateSetSource<T>)
    .where(and(eq(table.id, opts.id), eq(table.version, opts.expectedVersion)))
    .returning()) as Array<T["$inferSelect"]>;
  const after = rows[0];
  if (!after) {
    const latest = await selectById(tx, table, opts.id);
    if (!latest) throw new NotFoundError(entity, opts.id);
    throw await conflict(tx, table, latest);
  }

  const diff = { ...computeDiff(table, before as Record<string, unknown>, after as Record<string, unknown>), ...opts.extraDiff };
  await writeAudit(tx, { actorId: opts.actorId, entity, entityId: opts.id, action: opts.action ?? "update", diff });
  return { before, after, diff };
}

export async function softDeleteWithAudit<T extends AuditedTable>(
  tx: Tx,
  table: T,
  opts: { id: string; expectedVersion: number; actorId: string },
): Promise<UpdateResult<T["$inferSelect"]>> {
  return updateWithAudit(tx, table, {
    ...opts,
    values: { deletedAt: new Date() } as PgUpdateSetSource<T>,
    action: "delete",
  });
}

export async function restoreWithAudit<T extends AuditedTable>(
  tx: Tx,
  table: T,
  opts: { id: string; expectedVersion: number; actorId: string },
): Promise<UpdateResult<T["$inferSelect"]>> {
  return updateWithAudit(tx, table, {
    ...opts,
    values: { deletedAt: null } as PgUpdateSetSource<T>,
    action: "restore",
  });
}
