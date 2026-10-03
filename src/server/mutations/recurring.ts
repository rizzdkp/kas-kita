import { eq } from "drizzle-orm";
import { z } from "zod";
import { todayJakarta } from "@/lib/dates";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { recurringRules } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { buildRecurrenceRule, isDateKey } from "@/server/recurring/schedule";
import { parseTemplate, type RecurringTemplate } from "@/server/recurring/template";
import type { AuditValue } from "@/server/queries/audit";
import { dateKeySchema, inTransaction, parseInput, versionSchema } from "./_shared";
import { insertWithAudit, softDeleteWithAudit, updateWithAudit, type AuditDiff } from "./audit";
import { notifyOwners } from "./notify";
import { normalizeTagNames } from "./tags";
import { accountOwners, assertReferences, assertShape, normalizeShape, transactionFieldsSchema, transactionLabel } from "./transaction-input";

export type RecurringRuleRow = typeof recurringRules.$inferSelect;

export const recurringRuleFieldsSchema = transactionFieldsSchema
  .pick({ kind: true, amount: true, accountId: true, toAccountId: true, categoryId: true, note: true, beneficiary: true, tagNames: true })
  .extend({
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(12).default(1),
    nextRunOn: dateKeySchema.refine(isDateKey, "Tanggal belum terbaca. Pilih tanggal lagi."),
    autoConfirm: z.boolean().default(false),
  });
export type RecurringRuleFieldsInput = z.input<typeof recurringRuleFieldsSchema>;
type RecurringRuleFields = z.output<typeof recurringRuleFieldsSchema>;

const PAST_DATE_MESSAGE = "Tanggal berikutnya tidak boleh sebelum hari ini.";

function toTemplate(f: RecurringRuleFields): RecurringTemplate {
  const shaped = normalizeShape({ ...f });
  assertShape(shaped);
  return {
    kind: shaped.kind,
    amount: shaped.amount.toString(),
    accountId: shaped.accountId,
    toAccountId: shaped.toAccountId,
    categoryId: shaped.categoryId,
    note: shaped.note,
    beneficiary: shaped.kind === "expense" ? shaped.beneficiary : "owner",
    tagNames: normalizeTagNames(shaped.tagNames ?? []),
  };
}

function snake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// diff template jsonb dipecah per field supaya notifikasi partner bisa menyebut "Rp 300.000 menjadi Rp 350.000"
function notifyDiff(diff: AuditDiff): AuditDiff {
  const out: AuditDiff = {};
  for (const [field, [before, after]] of Object.entries(diff)) {
    if (field !== "template") {
      out[field] = [before, after];
      continue;
    }
    const b = (before ?? {}) as Record<string, AuditValue>;
    const a = (after ?? {}) as Record<string, AuditValue>;
    for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (JSON.stringify(b[key] ?? null) !== JSON.stringify(a[key] ?? null)) out[snake(key)] = [b[key] ?? null, a[key] ?? null];
    }
  }
  return out;
}

export async function recurringRuleLabel(tx: Tx, t: Pick<RecurringTemplate, "kind" | "categoryId" | "note">): Promise<string> {
  return t.note ?? (await transactionLabel(tx, t));
}

async function ownersOf(tx: Tx, templates: Array<RecurringTemplate | null>): Promise<Array<string | null>> {
  const ids = templates.flatMap((t) => (t ? [t.accountId, t.toAccountId] : []));
  const map = await accountOwners(tx, ids);
  return ids.filter((id): id is string => id !== null).map((id) => map.get(id) ?? null);
}

/** Jadwal baru; pembuatnya menjadi "Diisi oleh" transaksi yang dihasilkan job. */
export async function createRecurringRule(
  viewer: Viewer,
  input: RecurringRuleFieldsInput,
  db: DbOrTx = defaultDb,
  today: string = todayJakarta(),
): Promise<RecurringRuleRow> {
  const fields = parseInput(recurringRuleFieldsSchema, input);
  if (fields.nextRunOn < today) throw new ValidationError(PAST_DATE_MESSAGE, { nextRunOn: [PAST_DATE_MESSAGE] });
  const template = toTemplate(fields);
  return inTransaction(db, async (tx) => {
    await assertReferences(tx, [template]);
    return insertWithAudit(
      tx,
      recurringRules,
      {
        template,
        rrule: buildRecurrenceRule(fields.frequency, fields.nextRunOn, fields.interval),
        nextRunOn: fields.nextRunOn,
        autoConfirm: fields.autoConfirm,
        createdBy: viewer.user.id,
      },
      viewer.user.id,
    );
  });
}

const updateSchema = z.object({ id: z.uuid(), version: versionSchema, fields: recurringRuleFieldsSchema });

/** Ubah seluruh isian jadwal; versi lama ditolak (F-HIST-3). */
export async function updateRecurringRule(
  viewer: Viewer,
  input: z.input<typeof updateSchema>,
  db: DbOrTx = defaultDb,
  today: string = todayJakarta(),
): Promise<RecurringRuleRow> {
  const { id, version, fields } = parseInput(updateSchema, input);
  const template = toTemplate(fields);
  return inTransaction(db, async (tx) => {
    const [current] = await tx.select().from(recurringRules).where(eq(recurringRules.id, id));
    if (!current || current.deletedAt) throw new NotFoundError("recurring_rules", id);
    // tanggal lama yang tidak diubah boleh tetap (job belum sempat jalan); tanggal baru tidak boleh mundur
    if (fields.nextRunOn < today && fields.nextRunOn !== current.nextRunOn) {
      throw new ValidationError(PAST_DATE_MESSAGE, { nextRunOn: [PAST_DATE_MESSAGE] });
    }
    await assertReferences(tx, [template]);
    const result = await updateWithAudit(tx, recurringRules, {
      id,
      expectedVersion: version,
      actorId: viewer.user.id,
      values: {
        template,
        rrule: buildRecurrenceRule(fields.frequency, fields.nextRunOn, fields.interval),
        nextRunOn: fields.nextRunOn,
        autoConfirm: fields.autoConfirm,
      },
    });
    if (Object.keys(result.diff).length > 0) {
      await notifyOwners(tx, {
        ownerIds: await ownersOf(tx, [parseTemplate(current.template), template]),
        actor: viewer.user,
        entity: "recurring_rules",
        entityId: id,
        action: "update",
        label: `Transaksi berulang ${await recurringRuleLabel(tx, template)}`,
        diff: notifyDiff(result.diff),
      });
    }
    return result.after;
  });
}

/** Hapus jadwal; transaksi yang sudah dibuat dari jadwal ini tetap ada. */
export async function deleteRecurringRule(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<RecurringRuleRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const result = await softDeleteWithAudit(tx, recurringRules, { id, expectedVersion: version, actorId: viewer.user.id });
    const template = parseTemplate(result.after.template);
    await notifyOwners(tx, {
      ownerIds: await ownersOf(tx, [template]),
      actor: viewer.user,
      entity: "recurring_rules",
      entityId: id,
      action: "delete",
      label: template ? `Transaksi berulang ${await recurringRuleLabel(tx, template)}` : "Transaksi berulang",
      diff: {},
    });
    return result.after;
  });
}

/** Majukan next_run_on setelah job membuat transaksi; dicatat di audit atas nama pembuat jadwal. */
export async function advanceRecurringRule(tx: Tx, rule: RecurringRuleRow, nextRunOn: string): Promise<RecurringRuleRow> {
  const result = await updateWithAudit(tx, recurringRules, {
    id: rule.id,
    expectedVersion: rule.version,
    actorId: rule.createdBy,
    values: { nextRunOn },
  });
  return result.after;
}
