import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatShortDate, parseDateKey, todayJakarta } from "@/lib/dates";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { accounts, investmentValuations } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { dateKeySchema, inTransaction, parseInput, pickProvided, signedAmountSchema, versionSchema } from "./_shared";
import { insertWithAudit, softDeleteWithAudit, updateWithAudit, type UpdateResult } from "./audit";
import { notifyOwners } from "./notify";

export type ValuationRow = typeof investmentValuations.$inferSelect;

const valuedOnSchema = dateKeySchema.refine((key) => key <= todayJakarta(), "Tanggal nilai tidak boleh setelah hari ini");

const valuationFieldsSchema = z.object({
  valuedOn: valuedOnSchema,
  marketValue: signedAmountSchema.refine((v) => v >= 0n, "Nilai pasar tidak boleh negatif"),
  note: z
    .string()
    .trim()
    .max(200, "Catatan maksimal 200 karakter")
    .nullish()
    .transform((v) => (v ? v : null)),
});

const createValuationSchema = valuationFieldsSchema.extend({ accountId: z.uuid() });
export type CreateValuationInput = z.input<typeof createValuationSchema>;

async function investmentAccount(tx: Tx, accountId: string) {
  const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account || account.deletedAt) throw new NotFoundError("accounts", accountId);
  if (account.type !== "investment") {
    throw new ValidationError("Nilai pasar hanya untuk akun Investasi", { accountId: ["Pilih akun Investasi"] });
  }
  return account;
}

function valuationLabel(accountName: string, valuedOn: string): string {
  const day = parseDateKey(valuedOn);
  return `nilai ${accountName}${day ? ` ${formatShortDate(day)}` : ""}`;
}

async function notifyValuationOwner(tx: Tx, viewer: Viewer, result: UpdateResult<ValuationRow>, action: "update" | "delete") {
  const account = await investmentAccount(tx, result.after.accountId);
  await notifyOwners(tx, {
    ownerIds: [account.ownerId],
    actor: viewer.user,
    entity: "investment_valuations",
    entityId: result.after.id,
    action,
    label: valuationLabel(account.name, result.after.valuedOn),
    diff: result.diff,
  });
}

/** Pembaruan nilai pasar manual (F-INV-1); setiap pembaruan jadi satu titik di grafik. */
export async function createValuation(viewer: Viewer, input: CreateValuationInput, db: DbOrTx = defaultDb): Promise<ValuationRow> {
  const data = parseInput(createValuationSchema, input);
  return inTransaction(db, async (tx) => {
    await investmentAccount(tx, data.accountId);
    return insertWithAudit(tx, investmentValuations, data, viewer.user.id);
  });
}

const updateValuationSchema = z.object({ id: z.uuid(), version: versionSchema, patch: valuationFieldsSchema.partial() });

export async function updateValuation(
  viewer: Viewer,
  input: z.input<typeof updateValuationSchema>,
  db: DbOrTx = defaultDb,
): Promise<ValuationRow> {
  const parsed = parseInput(updateValuationSchema, input);
  const patch = pickProvided(parsed.patch, (input as { patch?: unknown }).patch);
  return inTransaction(db, async (tx) => {
    const result = await updateWithAudit(tx, investmentValuations, {
      id: parsed.id,
      expectedVersion: parsed.version,
      actorId: viewer.user.id,
      values: patch,
    });
    if (Object.keys(result.diff).length > 0) await notifyValuationOwner(tx, viewer, result, "update");
    return result.after;
  });
}

export async function deleteValuation(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<ValuationRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const result = await softDeleteWithAudit(tx, investmentValuations, { id, expectedVersion: version, actorId: viewer.user.id });
    await notifyValuationOwner(tx, viewer, result, "delete");
    return result.after;
  });
}
