import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createHousehold, seedBasicCategories, type Household } from "../helpers/fixtures";
import { budgets } from "@/server/db/schema";
import { copyBudgetsFromPreviousMonth } from "@/server/mutations/budget-copy";
import { deleteBudget, upsertBudget } from "@/server/mutations/budgets";

// tombol "Salin anggaran bulan lalu" di halaman Anggaran; berkas ini ikut pola forecast* milik agen anggaran
let h: Household;
let c: Awaited<ReturnType<typeof seedBasicCategories>>;

beforeAll(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  c = await seedBasicCategories(testDb);
  const me = `user:${h.rizz.user.id}`;
  const partner = `user:${h.nadia.user.id}`;
  await upsertBudget(h.rizz, { scopeOwner: me, categoryId: c.food.id, month: "2026-08-01", amount: 2_000_000n, isMandatory: true }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: me, categoryId: c.transport.id, month: "2026-08-01", amount: 500_000n }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: partner, categoryId: c.food.id, month: "2026-08-01", amount: 1_000_000n }, testDb);
  await upsertBudget(h.rizz, { scopeOwner: "shared", categoryId: c.food.id, month: "2026-08-01", amount: 3_000_000n }, testDb);
  const removed = await upsertBudget(h.rizz, { scopeOwner: me, categoryId: c.coffee.id, month: "2026-08-01", amount: 100_000n }, testDb);
  await deleteBudget(h.rizz, { id: removed.id, version: removed.version }, testDb);
  // sudah ada di September, tidak boleh ditimpa
  await upsertBudget(h.rizz, { scopeOwner: me, categoryId: c.transport.id, month: "2026-09-01", amount: 750_000n }, testDb);
});

afterAll(closeDb);

async function september(scopeOwner: string) {
  return testDb
    .select({ categoryId: budgets.categoryId, amount: budgets.amount, isMandatory: budgets.isMandatory })
    .from(budgets)
    .where(and(eq(budgets.month, "2026-09-01"), eq(budgets.scopeOwner, scopeOwner), isNull(budgets.deletedAt)));
}

describe("copyBudgetsFromPreviousMonth", () => {
  it("menyalin anggaran pemilik yang diminta, melewati yang sudah ada dan yang terhapus", async () => {
    const me = `user:${h.rizz.user.id}`;
    const result = await copyBudgetsFromPreviousMonth(h.rizz, { month: "2026-09-15", scopeOwners: [me] }, testDb);
    expect(result).toEqual({ copied: 1 });
    const rows = await september(me);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.categoryId === c.food.id)).toMatchObject({ amount: 2_000_000n, isMandatory: true });
    expect(rows.find((r) => r.categoryId === c.transport.id)).toMatchObject({ amount: 750_000n });
    expect(await september("shared")).toHaveLength(0);
    expect(await september(`user:${h.nadia.user.id}`)).toHaveLength(0);
  });

  it("Gabungan ikut menyalin Partner dan Bersama; menjalankan ulang tidak menggandakan", async () => {
    const owners = [`user:${h.rizz.user.id}`, `user:${h.nadia.user.id}`, "shared"];
    expect(await copyBudgetsFromPreviousMonth(h.rizz, { month: "2026-09-01", scopeOwners: owners }, testDb)).toEqual({ copied: 2 });
    expect(await copyBudgetsFromPreviousMonth(h.rizz, { month: "2026-09-01", scopeOwners: owners }, testDb)).toEqual({ copied: 0 });
    expect(await september("shared")).toEqual([{ categoryId: c.food.id, amount: 3_000_000n, isMandatory: false }]);
  });
});
