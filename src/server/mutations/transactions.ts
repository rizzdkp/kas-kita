import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { transactions } from "@/server/db/schema";
import { DomainError, NotFoundError } from "@/server/errors";
import { RESTORE_WINDOW_DAYS } from "@/server/queries/transactions";
import { inTransaction, parseInput, versionSchema, pickProvided } from "./_shared";
import { insertWithAudit, restoreWithAudit, selectById, softDeleteWithAudit, updateWithAudit, type AuditDiff } from "./audit";
import { assertBalancesAllowed, balanceEffects, type BalanceEffectSource } from "./balance-guard";
import { notifyOwners } from "./notify";
import { getTagNames, normalizeTagNames, setTags } from "./tags";
import {
  accountOwners,
  assertReferences,
  assertShape,
  createTransactionSchema,
  normalizeShape,
  transactionLabel,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "./transaction-input";

export type TransactionRow = typeof transactions.$inferSelect;

// field yang mengubah saldo; edit catatan saja tidak perlu dicek ulang terhadap saldo
const BALANCE_FIELDS = ["kind", "amount", "accountId", "toAccountId", "status"] as const;

async function insertOne(tx: Tx, viewer: Viewer, input: z.output<typeof createTransactionSchema>): Promise<TransactionRow> {
  const { tagNames, ...fields } = input;
  const names = normalizeTagNames(tagNames ?? []);
  const row = await insertWithAudit(
    tx,
    transactions,
    { ...fields, createdBy: viewer.user.id, updatedBy: viewer.user.id },
    viewer.user.id,
    names.length > 0 ? { tags: [[], names] } : undefined,
  );
  if (names.length > 0) await setTags(tx, row.id, names);
  return row;
}

async function findByClientId(tx: Tx, clientId: string | undefined): Promise<TransactionRow | undefined> {
  if (!clientId) return undefined;
  const [row] = await tx.select().from(transactions).where(eq(transactions.clientId, clientId));
  return row;
}

/** Simpan satu transaksi; client_id membuat kiriman ulang dari antrean offline tidak dobel. */
export async function createTransaction(viewer: Viewer, input: CreateTransactionInput, db: DbOrTx = defaultDb): Promise<TransactionRow> {
  const data = parseInput(createTransactionSchema, input);
  return inTransaction(db, async (tx) => {
    const existing = await findByClientId(tx, data.clientId);
    if (existing) return existing;
    await assertReferences(tx, [data]);
    await assertBalancesAllowed(tx, balanceEffects([data]));
    return insertOne(tx, viewer, data);
  });
}

/** Quick-add banyak baris ("Simpan semua"): semua atau tidak sama sekali. */
export async function createTransactions(
  viewer: Viewer,
  inputs: CreateTransactionInput[],
  db: DbOrTx = defaultDb,
): Promise<TransactionRow[]> {
  const list = parseInput(z.array(createTransactionSchema).min(1).max(100), inputs);
  return inTransaction(db, async (tx) => {
    const fresh: typeof list = [];
    const result: TransactionRow[] = [];
    for (const item of list) {
      const existing = await findByClientId(tx, item.clientId);
      if (existing) result.push(existing);
      else fresh.push(item);
    }
    await assertReferences(tx, fresh);
    await assertBalancesAllowed(tx, balanceEffects(fresh));
    for (const item of fresh) result.push(await insertOne(tx, viewer, item));
    return result;
  });
}

async function loadForWrite(tx: Tx, id: string): Promise<TransactionRow> {
  const row = await selectById(tx, transactions, id);
  if (!row) throw new NotFoundError("transaksi", id);
  return row;
}

async function notifyTransactionOwners(
  tx: Tx,
  viewer: Viewer,
  rows: TransactionRow[],
  action: "update" | "delete" | "restore",
  diff: AuditDiff,
): Promise<void> {
  const latest = rows[rows.length - 1]!;
  const owners = await accountOwners(tx, rows.flatMap((r) => [r.accountId, r.toAccountId]));
  await notifyOwners(tx, {
    ownerIds: [...owners.values()],
    actor: viewer.user,
    entity: "transactions",
    entityId: latest.id,
    action,
    label: await transactionLabel(tx, latest),
    occurredAt: rows[0]!.occurredAt,
    diff,
  });
}

export async function updateTransaction(viewer: Viewer, input: UpdateTransactionInput, db: DbOrTx = defaultDb): Promise<TransactionRow> {
  const parsed = parseInput(updateTransactionSchema, input);
  const { id, version } = parsed;
  const patch = pickProvided(parsed.patch, (input as { patch?: unknown }).patch);
  return inTransaction(db, async (tx) => {
    const current = await loadForWrite(tx, id);
    const { tagNames, ...fields } = patch;
    const merged = normalizeShape({ ...current, ...fields });
    assertShape(merged);
    await assertReferences(tx, [merged]);
    const balanceChanged = BALANCE_FIELDS.some((f) => merged[f] !== current[f]);
    if (balanceChanged && !current.deletedAt) {
      await assertBalancesAllowed(tx, balanceEffects([merged as BalanceEffectSource]), [id]);
    }

    let extraDiff: Record<string, [string[], string[]]> | undefined;
    if (tagNames) {
      const before = await getTagNames(tx, id);
      const after = await setTags(tx, id, tagNames);
      if (before.join("\u0000") !== after.join("\u0000")) extraDiff = { tags: [before, after] };
    }
    const values = {
      kind: merged.kind,
      amount: merged.amount,
      accountId: merged.accountId,
      toAccountId: merged.toAccountId,
      categoryId: merged.categoryId,
      occurredAt: merged.occurredAt,
      note: merged.note,
      beneficiary: merged.beneficiary,
      status: merged.status,
      source: merged.source,
    };
    const result = await updateWithAudit(tx, transactions, { id, expectedVersion: version, actorId: viewer.user.id, values, extraDiff });
    if (Object.keys(result.diff).length > 0) {
      await notifyTransactionOwners(tx, viewer, [current, result.after], "update", result.diff);
    }
    return result.after;
  });
}

export async function deleteTransaction(
  viewer: Viewer,
  input: { id: string; version: number },
  db: DbOrTx = defaultDb,
): Promise<TransactionRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const result = await softDeleteWithAudit(tx, transactions, { id, expectedVersion: version, actorId: viewer.user.id });
    await notifyTransactionOwners(tx, viewer, [result.after], "delete", result.diff);
    return result.after;
  });
}

/** Pulihkan dari "Baru dihapus" selama 30 hari (F-HIST-2 AC2); saldo dicek ulang. */
export async function restoreTransaction(viewer: Viewer, input: { id: string }, db: DbOrTx = defaultDb, now: Date = new Date()): Promise<TransactionRow> {
  const { id } = parseInput(z.object({ id: z.uuid() }), input);
  return inTransaction(db, async (tx) => {
    const current = await loadForWrite(tx, id);
    if (!current.deletedAt) return current;
    if (now.getTime() - current.deletedAt.getTime() > RESTORE_WINDOW_DAYS * 86_400_000) {
      throw new DomainError("restore_expired", "Transaksi ini dihapus lebih dari 30 hari lalu dan tidak bisa dipulihkan.");
    }
    await assertBalancesAllowed(tx, balanceEffects([current]));
    const result = await restoreWithAudit(tx, transactions, { id, expectedVersion: current.version, actorId: viewer.user.id });
    await notifyTransactionOwners(tx, viewer, [result.after], "restore", result.diff);
    return result.after;
  });
}
