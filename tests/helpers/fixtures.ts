import { eq } from "drizzle-orm";
import type { Viewer } from "@/server/auth/viewer";
import { accounts, categories, transactions, users, type AccountType } from "@/server/db/schema";
import type { TestDb } from "./db";

export interface Household {
  rizz: Viewer;
  nadia: Viewer;
}

export async function createHousehold(db: TestDb): Promise<Household> {
  const [rizz] = await db
    .insert(users)
    .values({ email: "rizz@contoh.test", name: "Rizz", displayName: "Rizz", identityColor: "violet", paydayDay: 25 })
    .returning();
  const [nadia] = await db
    .insert(users)
    .values({ email: "nadia@contoh.test", name: "Nadia", displayName: "Nadia", identityColor: "ocean", paydayDay: 1 })
    .returning();
  return {
    rizz: { user: rizz!, partner: nadia!, sessionId: "tes-rizz" },
    nadia: { user: nadia!, partner: rizz!, sessionId: "tes-nadia" },
  };
}

export async function createAccountRow(
  db: TestDb,
  values: { name: string; type: AccountType; ownerId: string | null; openingBalance?: bigint; openingDate?: string; allowNegative?: boolean },
) {
  const [row] = await db
    .insert(accounts)
    .values({ openingBalance: 0n, openingDate: "2026-01-01", ...values })
    .returning();
  return row!;
}

export async function createCategoryRow(
  db: TestDb,
  values: { name: string; kind: "income" | "expense" | "system"; parentId?: string; systemKey?: string; isSystem?: boolean },
) {
  const [row] = await db.insert(categories).values(values).returning();
  return row!;
}

export async function seedBasicCategories(db: TestDb) {
  const food = await createCategoryRow(db, { name: "Makan dan minum", kind: "expense" });
  const groceries = await createCategoryRow(db, { name: "Belanja dapur", kind: "expense", parentId: food.id });
  const coffee = await createCategoryRow(db, { name: "Kopi dan jajan", kind: "expense", parentId: food.id });
  const transport = await createCategoryRow(db, { name: "Transportasi", kind: "expense" });
  const salary = await createCategoryRow(db, { name: "Gaji", kind: "income" });
  const adjustment = await createCategoryRow(db, { name: "Penyesuaian saldo", kind: "system", systemKey: "adjustment", isSystem: true });
  const transfer = await createCategoryRow(db, { name: "Transfer", kind: "system", systemKey: "transfer", isSystem: true });
  return { food, groceries, coffee, transport, salary, adjustment, transfer };
}

/** Insert langsung tanpa mutasi, untuk fixture metrik dan cakupan. */
export async function insertTx(
  db: TestDb,
  values: {
    kind: "income" | "expense" | "transfer";
    amount: bigint;
    accountId: string;
    toAccountId?: string;
    categoryId?: string;
    occurredAt: Date | string;
    createdBy: string;
    status?: "confirmed" | "draft";
    note?: string;
  },
) {
  const occurredAt = typeof values.occurredAt === "string" ? new Date(values.occurredAt) : values.occurredAt;
  const [row] = await db
    .insert(transactions)
    .values({ ...values, occurredAt, updatedBy: values.createdBy })
    .returning();
  return row!;
}

export async function getTx(db: TestDb, id: string) {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
  return row!;
}
