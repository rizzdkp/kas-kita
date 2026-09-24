import { eq, inArray } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
import { tags, transactionTags } from "@/server/db/schema";

export async function getTagNames(tx: Tx, transactionId: string): Promise<string[]> {
  const rows = await tx
    .select({ name: tags.name })
    .from(transactionTags)
    .innerJoin(tags, eq(tags.id, transactionTags.tagId))
    .where(eq(transactionTags.transactionId, transactionId));
  return rows.map((r) => r.name).sort();
}

export function normalizeTagNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort();
}

/** Ganti tag transaksi; tag dipakai bersama dan dibuat otomatis kalau belum ada. */
export async function setTags(tx: Tx, transactionId: string, names: string[]): Promise<string[]> {
  const unique = normalizeTagNames(names);
  await tx.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
  if (unique.length === 0) return [];
  await tx.insert(tags).values(unique.map((name) => ({ name }))).onConflictDoNothing({ target: tags.name });
  const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, unique));
  await tx.insert(transactionTags).values(rows.map((r) => ({ transactionId, tagId: r.id })));
  return unique;
}
