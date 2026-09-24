"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { type ActionResult, runAction } from "@/server/actions/result";
import { createBill, deleteBill, payBill, updateBill } from "@/server/mutations/bills";
import { amountSchema, dateKeySchema, parseInput, versionSchema } from "@/server/mutations/_shared";
import { todayJakarta } from "@/lib/dates";
import { startOfKey } from "@/server/metrics/_time";

// tanggal lampau dicatat pukul 12.00 WIB supaya tidak bergeser hari
const NOON_MS = 12 * 60 * 60 * 1000;

function paidAtFromKey(key: string, now: Date = new Date()): Date {
  return key === todayJakarta(now) ? now : new Date(startOfKey(key).getTime() + NOON_MS);
}

const fieldsSchema = z.object({
  name: z.string(),
  ownerId: z.string().nullable(),
  amount: amountSchema.optional(),
  amountIsEstimate: z.boolean(),
  payFromAccountId: z.string(),
  categoryId: z.string().nullable(),
  creditCardAccountId: z.string().nullable(),
  rrule: z.string(),
  nextDueOn: dateKeySchema,
});

export type BillFieldsInput = z.input<typeof fieldsSchema>;

export async function createBillAction(input: BillFieldsInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await createBill(viewer, parseInput(fieldsSchema, input));
    return { id: row.id };
  });
}

const updateSchema = z.object({ id: z.string(), version: versionSchema, fields: fieldsSchema });

export async function updateBillAction(input: z.input<typeof updateSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { id, version, fields } = parseInput(updateSchema, input);
    const row = await updateBill(viewer, { id, version, patch: fields });
    return { id: row.id };
  });
}

const deleteSchema = z.object({ id: z.string(), version: versionSchema });

export async function deleteBillAction(input: z.input<typeof deleteSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await deleteBill(viewer, parseInput(deleteSchema, input));
    return { id: row.id };
  });
}

const paySchema = z.object({
  id: z.string(),
  version: versionSchema,
  amount: amountSchema,
  payFromAccountId: z.string(),
  paidOn: dateKeySchema,
});

export async function payBillAction(
  input: z.input<typeof paySchema>,
): Promise<ActionResult<{ nextDueOn: string; transactionId: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(paySchema, input);
    const { bill, transaction } = await payBill(viewer, {
      id: data.id,
      version: data.version,
      amount: data.amount,
      payFromAccountId: data.payFromAccountId,
      paidAt: paidAtFromKey(data.paidOn),
    });
    return { nextDueOn: bill.nextDueOn, transactionId: transaction.id };
  });
}
