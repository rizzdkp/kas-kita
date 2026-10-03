"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { ACCOUNT_TYPES } from "@/server/db/schema";
import { archiveAccount, createAccount, deleteAccount, updateAccount, type AccountRow } from "@/server/mutations/accounts";
import { reconcileAccount, type ReconcileResult } from "@/server/mutations/reconcile";
import { parseInput } from "@/server/mutations/_shared";
import { getReconcilePreview } from "@/server/queries/accounts";
import { runAction, toActionError, type ActionResult } from "./result";

const money = z.bigint();
const dayOfMonth = z.number().int().min(1).max(31).nullable();

const accountFormSchema = z.object({
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  ownerId: z.uuid().nullable(),
  institutionId: z.uuid().nullable(),
  openingBalance: money,
  openingDate: z.string(),
  allowNegative: z.boolean(),
  creditLimit: money.nullable(),
  statementDay: dayOfMonth,
  dueDay: dayOfMonth,
});
export type AccountFormInput = z.infer<typeof accountFormSchema>;

const idVersion = z.object({ id: z.uuid(), version: z.number().int().positive() });

export async function createAccountAction(input: AccountFormInput): Promise<ActionResult<AccountRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return createAccount(viewer, parseInput(accountFormSchema, input));
  });
}

export async function updateAccountAction(input: {
  id: string;
  version: number;
  patch: Partial<AccountFormInput>;
}): Promise<ActionResult<AccountRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(idVersion.extend({ patch: accountFormSchema.partial() }), input);
    return updateAccount(viewer, data);
  });
}

export async function setAccountArchivedAction(input: { id: string; version: number; archived: boolean }): Promise<ActionResult<AccountRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return archiveAccount(viewer, parseInput(idVersion.extend({ archived: z.boolean() }), input));
  });
}

export async function deleteAccountAction(input: { id: string; version: number }): Promise<ActionResult<AccountRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return deleteAccount(viewer, parseInput(idVersion, input));
  });
}

export interface ReconcilePreview {
  recorded: bigint;
  actual: bigint;
  difference: bigint;
}

export async function reconcilePreviewAction(input: { accountId: string; actualBalance: bigint }): Promise<ActionResult<ReconcilePreview>> {
  // pratinjau hanya membaca, jadi tidak lewat runAction yang menyegarkan semua halaman
  try {
    await requireViewer();
    const data = parseInput(z.object({ accountId: z.uuid(), actualBalance: money }), input);
    const { recorded, actual, difference } = await getReconcilePreview(data.accountId, data.actualBalance);
    return { ok: true, data: { recorded, actual, difference } };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return toActionError(e);
  }
}

export async function reconcileAccountAction(input: {
  accountId: string;
  version: number;
  actualBalance: bigint;
}): Promise<ActionResult<Omit<ReconcileResult, "adjustment"> & { adjustmentId: string | null }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(z.object({ accountId: z.uuid(), version: z.number().int().positive(), actualBalance: money }), input);
    const { adjustment, ...rest } = await reconcileAccount(viewer, data);
    return { ...rest, adjustmentId: adjustment?.id ?? null };
  });
}
