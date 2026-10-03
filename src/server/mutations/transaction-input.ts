import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/server/db/client";
import { accounts, categories, TRANSACTION_KINDS } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { amountSchema } from "./_shared";

export const transactionFieldsSchema = z.object({
  kind: z.enum(TRANSACTION_KINDS),
  amount: amountSchema,
  accountId: z.uuid(),
  toAccountId: z.uuid().nullish().transform((v) => v ?? null),
  categoryId: z.uuid().nullish().transform((v) => v ?? null),
  occurredAt: z.coerce.date(),
  note: z
    .string()
    .max(500)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  beneficiary: z.enum(["owner", "partner_of_owner", "shared"]).default("owner"),
  status: z.enum(["confirmed", "draft"]).default("confirmed"),
  source: z.enum(["manual", "quick_add", "receipt", "import_csv", "import_pdf", "recurring", "adjustment"]).default("manual"),
  tagNames: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

type ShapeFields = { kind: string; accountId: string; toAccountId: string | null; categoryId: string | null };

function shapeIssues(t: ShapeFields): Array<{ path: string; message: string }> {
  if (t.kind === "transfer") {
    if (!t.toAccountId) return [{ path: "toAccountId", message: "Pilih akun tujuan transfer" }];
    if (t.toAccountId === t.accountId) return [{ path: "toAccountId", message: "Akun tujuan harus berbeda dari akun asal" }];
    return [];
  }
  return t.categoryId ? [] : [{ path: "categoryId", message: "Pilih kategori" }];
}

function checkShape(t: ShapeFields, ctx: z.RefinementCtx) {
  for (const i of shapeIssues(t)) ctx.addIssue({ code: "custom", path: [i.path], message: i.message });
}

export const createTransactionSchema = transactionFieldsSchema
  .extend({
    clientId: z.string().min(8).max(100).optional(),
    recurringId: z.uuid().optional(),
    importRowId: z.uuid().optional(),
  })
  .superRefine(checkShape);
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type TransactionFields = z.output<typeof transactionFieldsSchema>;

export const updateTransactionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  patch: transactionFieldsSchema.partial(),
});
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;

/** Bentuk final setelah patch digabung; transfer tidak punya kategori, selain transfer tidak punya akun tujuan. */
export function normalizeShape<T extends { kind: string; toAccountId: string | null; categoryId: string | null }>(t: T): T {
  return t.kind === "transfer" ? { ...t, categoryId: null } : { ...t, toAccountId: null };
}

export function assertShape(t: ShapeFields) {
  const [issue] = shapeIssues(t);
  if (issue) throw new ValidationError(issue.message, { [issue.path]: [issue.message] });
}

/** Akun ada dan belum dihapus, kategori cocok dengan jenis transaksi. */
export async function assertReferences(
  tx: Tx,
  items: Array<{ kind: string; accountId: string; toAccountId: string | null; categoryId: string | null }>,
): Promise<void> {
  const accountIds = [...new Set(items.flatMap((t) => [t.accountId, ...(t.toAccountId ? [t.toAccountId] : [])]))];
  const found = await tx.select({ id: accounts.id, deletedAt: accounts.deletedAt }).from(accounts).where(inArray(accounts.id, accountIds));
  for (const id of accountIds) {
    const a = found.find((x) => x.id === id);
    if (!a || a.deletedAt) throw new ValidationError("Akun tidak ditemukan. Pilih akun lain.", { accountId: ["Akun tidak ditemukan"] });
  }
  const categoryIds = [...new Set(items.flatMap((t) => (t.categoryId ? [t.categoryId] : [])))];
  if (categoryIds.length === 0) return;
  const cats = await tx.select({ id: categories.id, kind: categories.kind }).from(categories).where(inArray(categories.id, categoryIds));
  for (const t of items) {
    if (!t.categoryId) continue;
    const c = cats.find((x) => x.id === t.categoryId);
    if (!c) throw new ValidationError("Kategori tidak ditemukan. Pilih kategori lain.", { categoryId: ["Kategori tidak ditemukan"] });
    if (c.kind !== "system" && c.kind !== t.kind) {
      throw new ValidationError("Kategori tidak cocok dengan jenis transaksi", { categoryId: ["Kategori tidak cocok"] });
    }
  }
}

export async function accountOwners(tx: Tx, ids: Array<string | null>): Promise<Map<string, string | null>> {
  const list = [...new Set(ids.filter((x): x is string => x !== null))];
  const map = new Map<string, string | null>();
  if (list.length === 0) return map;
  const rows = await tx.select({ id: accounts.id, ownerId: accounts.ownerId }).from(accounts).where(inArray(accounts.id, list));
  for (const r of rows) map.set(r.id, r.ownerId);
  return map;
}

export async function transactionLabel(tx: Tx, t: { kind: string; categoryId: string | null; note: string | null }): Promise<string> {
  if (t.categoryId) {
    const [c] = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, t.categoryId));
    if (c) return c.name;
  }
  return t.note ?? (t.kind === "transfer" ? "Transfer" : "Transaksi");
}
