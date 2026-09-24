import { eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, ACCOUNT_TYPES, transactions } from "@/server/db/schema";
import { DomainError, ValidationError } from "@/server/errors";
import { amountSchema, dateKeySchema, inTransaction, parseInput, signedAmountSchema, versionSchema, pickProvided } from "./_shared";
import { insertWithAudit, softDeleteWithAudit, updateWithAudit, type UpdateResult } from "./audit";
import { notifyOwners } from "./notify";

export type AccountRow = typeof accounts.$inferSelect;

const dayOfMonth = z.number().int().min(1).max(31);

const accountFieldsSchema = z.object({
  name: z.string().trim().min(1, "Isi nama akun").max(60),
  type: z.enum(ACCOUNT_TYPES),
  /** null = Bersama. */
  ownerId: z.uuid().nullable(),
  institutionId: z.uuid().nullish().transform((v) => v ?? null),
  openingBalance: signedAmountSchema.default(0n),
  openingDate: dateKeySchema,
  allowNegative: z.boolean().default(false),
  creditLimit: amountSchema.nullish().transform((v) => v ?? null),
  statementDay: dayOfMonth.nullish().transform((v) => v ?? null),
  dueDay: dayOfMonth.nullish().transform((v) => v ?? null),
  sortOrder: z.number().int().default(0),
});
export type CreateAccountInput = z.input<typeof accountFieldsSchema>;

function assertOwner(viewer: Viewer, ownerId: string | null) {
  const household = [viewer.user.id, viewer.partner?.id].filter(Boolean);
  if (ownerId !== null && !household.includes(ownerId)) {
    throw new ValidationError("Pemilik akun harus kamu, partner, atau Bersama", { ownerId: ["Pemilik tidak dikenal"] });
  }
}

/** Tunai tidak pernah boleh negatif, jadi allow_negative diabaikan (DATA-MODEL accounts). */
function normalizeAccount<T extends { type: string; allowNegative: boolean; openingBalance: bigint }>(a: T): T {
  if (a.type === "cash" && a.openingBalance < 0n) {
    throw new ValidationError("Saldo awal Tunai tidak boleh negatif", { openingBalance: ["Tidak boleh negatif"] });
  }
  return a.type === "cash" ? { ...a, allowNegative: false } : a;
}

export async function createAccount(viewer: Viewer, input: CreateAccountInput, db: DbOrTx = defaultDb): Promise<AccountRow> {
  const data = normalizeAccount(parseInput(accountFieldsSchema, input));
  assertOwner(viewer, data.ownerId);
  return inTransaction(db, (tx) => insertWithAudit(tx, accounts, data, viewer.user.id));
}

const updateAccountSchema = z.object({ id: z.uuid(), version: versionSchema, patch: accountFieldsSchema.partial() });

async function notifyAccountOwners(
  tx: Parameters<typeof notifyOwners>[0],
  viewer: Viewer,
  result: UpdateResult<AccountRow>,
  action: "update" | "delete",
) {
  await notifyOwners(tx, {
    ownerIds: [result.before.ownerId, result.after.ownerId],
    actor: viewer.user,
    entity: "accounts",
    entityId: result.after.id,
    action,
    label: result.after.name,
    diff: result.diff,
  });
}

/** Ubah akun; ganti pemilik otomatis memindahkan semua transaksinya karena pemilik transaksi diturunkan dari akun (F-ACC-1 AC2). */
export async function updateAccount(viewer: Viewer, input: z.input<typeof updateAccountSchema>, db: DbOrTx = defaultDb): Promise<AccountRow> {
  const parsed = parseInput(updateAccountSchema, input);
  const { id, version } = parsed;
  const patch = pickProvided(parsed.patch, (input as { patch?: unknown }).patch);
  if (patch.ownerId !== undefined) assertOwner(viewer, patch.ownerId);
  return inTransaction(db, async (tx) => {
    const [current] = await tx.select().from(accounts).where(eq(accounts.id, id));
    const values = current ? { ...patch, allowNegative: normalizeAccount({ ...current, ...patch }).allowNegative } : patch;
    const result = await updateWithAudit(tx, accounts, { id, expectedVersion: version, actorId: viewer.user.id, values });
    if (Object.keys(result.diff).length > 0) await notifyAccountOwners(tx, viewer, result, "update");
    return result.after;
  });
}

export async function archiveAccount(
  viewer: Viewer,
  input: { id: string; version: number; archived?: boolean },
  db: DbOrTx = defaultDb,
): Promise<AccountRow> {
  const { id, version, archived } = parseInput(
    z.object({ id: z.uuid(), version: versionSchema, archived: z.boolean().default(true) }),
    input,
  );
  return inTransaction(db, async (tx) => {
    const result = await updateWithAudit(tx, accounts, {
      id,
      expectedVersion: version,
      actorId: viewer.user.id,
      values: { archivedAt: archived ? new Date() : null },
    });
    await notifyAccountOwners(tx, viewer, result, "update");
    return result.after;
  });
}

/** Akun dengan transaksi tidak bisa dihapus, opsinya arsip (F-ACC-1 AC1). */
export async function deleteAccount(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<AccountRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)));
    if ((used?.n ?? 0) > 0) {
      throw new DomainError("account_has_transactions", "Akun ini punya transaksi, jadi tidak bisa dihapus. Arsipkan supaya riwayatnya tetap ada.");
    }
    const result = await softDeleteWithAudit(tx, accounts, { id, expectedVersion: version, actorId: viewer.user.id });
    await notifyAccountOwners(tx, viewer, result, "delete");
    return result.after;
  });
}
