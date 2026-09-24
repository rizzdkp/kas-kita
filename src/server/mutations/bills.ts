import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { accounts, billPayments, bills } from "@/server/db/schema";
import { DomainError, NotFoundError, ValidationError } from "@/server/errors";
import { isValidRrule, nextOccurrence } from "@/server/metrics/_rrule";
import { creditCardStatementAmount } from "@/server/queries/bills";
import { amountSchema, dateKeySchema, inTransaction, parseInput, versionSchema, pickProvided } from "./_shared";
import { insertWithAudit, softDeleteWithAudit, updateWithAudit } from "./audit";
import { notifyOwners } from "./notify";
import { createTransaction, type TransactionRow } from "./transactions";

export type BillRow = typeof bills.$inferSelect;

const billFieldsSchema = z.object({
  name: z.string().trim().min(1, "Isi nama tagihan").max(80),
  ownerId: z.uuid().nullable(),
  amount: amountSchema.optional(),
  amountIsEstimate: z.boolean().default(false),
  payFromAccountId: z.uuid(),
  categoryId: z.uuid().nullish().transform((v) => v ?? null),
  creditCardAccountId: z.uuid().nullish().transform((v) => v ?? null),
  rrule: z.string().refine(isValidRrule, "Pengulangan tidak dikenali. Pilih Bulanan, Mingguan, atau Tahunan."),
  nextDueOn: dateKeySchema,
});

function checkBill(b: { amount?: bigint; categoryId: string | null; creditCardAccountId: string | null }) {
  // tagihan kartu kredit dibayar lewat transfer dan nominalnya dihitung dari siklus cetak (F-BILL-1 AC1, AC3)
  if (b.creditCardAccountId) return;
  if (!b.categoryId) throw new ValidationError("Pilih kategori tagihan", { categoryId: ["Pilih kategori"] });
  if (b.amount === undefined) throw new ValidationError("Isi nominal, misalnya 25rb", { amount: ["Isi nominal"] });
}

export async function createBill(viewer: Viewer, input: z.input<typeof billFieldsSchema>, db: DbOrTx = defaultDb): Promise<BillRow> {
  const data = parseInput(billFieldsSchema, input);
  checkBill(data);
  return inTransaction(db, (tx) =>
    insertWithAudit(tx, bills, { ...data, amount: data.amount ?? 0n }, viewer.user.id),
  );
}

const updateBillSchema = z.object({ id: z.uuid(), version: versionSchema, patch: billFieldsSchema.partial() });

export async function updateBill(viewer: Viewer, input: z.input<typeof updateBillSchema>, db: DbOrTx = defaultDb): Promise<BillRow> {
  const parsed = parseInput(updateBillSchema, input);
  const { id, version } = parsed;
  const patch = pickProvided(parsed.patch, (input as { patch?: unknown }).patch);
  return inTransaction(db, async (tx) => {
    const [current] = await tx.select().from(bills).where(eq(bills.id, id));
    if (!current) throw new NotFoundError("bills", id);
    checkBill({ ...current, ...patch, amount: patch.amount ?? current.amount });
    const result = await updateWithAudit(tx, bills, { id, expectedVersion: version, actorId: viewer.user.id, values: patch });
    if (Object.keys(result.diff).length > 0) {
      await notifyOwners(tx, {
        ownerIds: [result.before.ownerId, result.after.ownerId],
        actor: viewer.user,
        entity: "bills",
        entityId: id,
        action: "update",
        label: result.after.name,
        diff: result.diff,
      });
    }
    return result.after;
  });
}

export async function deleteBill(viewer: Viewer, input: { id: string; version: number }, db: DbOrTx = defaultDb): Promise<BillRow> {
  const { id, version } = parseInput(z.object({ id: z.uuid(), version: versionSchema }), input);
  return inTransaction(db, async (tx) => {
    const result = await softDeleteWithAudit(tx, bills, { id, expectedVersion: version, actorId: viewer.user.id });
    await notifyOwners(tx, {
      ownerIds: [result.after.ownerId],
      actor: viewer.user,
      entity: "bills",
      entityId: id,
      action: "delete",
      label: result.after.name,
      diff: result.diff,
    });
    return result.after;
  });
}

const payBillSchema = z.object({
  id: z.uuid(),
  version: versionSchema,
  /** Kosong = nominal tagihan, atau hasil hitung siklus untuk kartu kredit. */
  amount: amountSchema.optional(),
  paidAt: z.coerce.date().optional(),
  payFromAccountId: z.uuid().optional(),
});

/** "Bayar": buat transaksi, catat bill_payments untuk periode ini, majukan jatuh tempo. */
export async function payBill(
  viewer: Viewer,
  input: z.input<typeof payBillSchema>,
  db: DbOrTx = defaultDb,
): Promise<{ bill: BillRow; transaction: TransactionRow }> {
  const data = parseInput(payBillSchema, input);
  return inTransaction(db, async (tx) => {
    const [bill] = await tx.select().from(bills).where(eq(bills.id, data.id));
    if (!bill || bill.deletedAt) throw new NotFoundError("bills", data.id);
    const payFrom = data.payFromAccountId ?? bill.payFromAccountId;
    let amount = data.amount ?? bill.amount;
    if (!data.amount && bill.creditCardAccountId) {
      const [card] = await tx.select().from(accounts).where(eq(accounts.id, bill.creditCardAccountId));
      if (!card) throw new NotFoundError("accounts", bill.creditCardAccountId);
      amount = await creditCardStatementAmount(card, bill.nextDueOn, tx);
    }
    if (amount <= 0n) throw new DomainError("nothing_to_pay", "Tidak ada nominal yang perlu dibayar untuk periode ini.");

    const transaction = await createTransaction(
      viewer,
      bill.creditCardAccountId
        ? { kind: "transfer", amount, accountId: payFrom, toAccountId: bill.creditCardAccountId, occurredAt: data.paidAt ?? new Date(), note: bill.name }
        : { kind: "expense", amount, accountId: payFrom, categoryId: bill.categoryId, occurredAt: data.paidAt ?? new Date(), note: bill.name },
      tx,
    );
    const inserted = await tx
      .insert(billPayments)
      .values({ billId: bill.id, periodStart: bill.nextDueOn, transactionId: transaction.id, paidAt: data.paidAt ?? new Date() })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) throw new DomainError("already_paid", "Tagihan periode ini sudah dibayar.");

    const result = await updateWithAudit(tx, bills, {
      id: bill.id,
      expectedVersion: data.version,
      actorId: viewer.user.id,
      values: { nextDueOn: nextOccurrence(bill.rrule, bill.nextDueOn) },
    });
    return { bill: result.after, transaction };
  });
}
