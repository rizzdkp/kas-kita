"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { ACCOUNT_TYPES } from "@/server/db/schema";
import { todayJakarta } from "@/lib/dates";
import { createAccount } from "@/server/mutations/accounts";
import { archiveCategory, createCategory, updateCategory } from "@/server/mutations/categories";
import { parseInput } from "@/server/mutations/_shared";
import { markOnboarded, updateProfile, type UpdateProfileInput } from "@/server/mutations/users";
import { runAction, type ActionResult } from "./result";

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult<{ displayName: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const user = await updateProfile(viewer, input);
    return { displayName: user.displayName };
  });
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await markOnboarded(viewer);
  });
}

const onboardingAccountSchema = z.object({
  name: z.string().trim().min(1, "Isi nama akun"),
  type: z.enum(ACCOUNT_TYPES),
  owner: z.enum(["me", "partner", "shared"]),
  balance: z.bigint("Isi saldo hari ini, misalnya 1,5jt"),
});

// kewajiban disimpan negatif (PRD 5.4); pengguna cukup mengetik besar utangnya
const LIABILITY_TYPES = new Set(["credit_card", "paylater", "loan"]);

/** Akun dari pengenalan: saldo hari ini jadi saldo awal per hari ini. */
export async function createOnboardingAccountAction(input: z.input<typeof onboardingAccountSchema>): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(onboardingAccountSchema, input);
    const ownerId = data.owner === "me" ? viewer.user.id : data.owner === "partner" ? (viewer.partner?.id ?? null) : null;
    const balance = LIABILITY_TYPES.has(data.type) && data.balance > 0n ? -data.balance : data.balance;
    const account = await createAccount(viewer, {
      name: data.name,
      type: data.type,
      ownerId,
      openingBalance: balance,
      openingDate: todayJakarta(),
    });
    return { id: account.id, name: account.name };
  });
}

const categoryInputSchema = z.object({
  name: z.string(),
  kind: z.enum(["income", "expense"]),
  parentId: z.uuid().nullable(),
  icon: z.string(),
});

export async function createCategoryAction(input: z.input<typeof categoryInputSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(categoryInputSchema, input);
    const row = await createCategory(viewer, data);
    return { id: row.id };
  });
}

const categoryPatchSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  patch: z.object({ name: z.string().optional(), icon: z.string().optional(), parentId: z.uuid().nullable().optional() }),
});

export async function updateCategoryAction(input: z.input<typeof categoryPatchSchema>): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(categoryPatchSchema, input);
    const row = await updateCategory(viewer, data);
    return { version: row.version };
  });
}

const archiveSchema = z.object({ id: z.uuid(), version: z.number().int().positive(), archived: z.boolean() });

export async function archiveCategoryAction(input: z.input<typeof archiveSchema>): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = parseInput(archiveSchema, input);
    const row = await archiveCategory(viewer, data);
    return { version: row.version };
  });
}
