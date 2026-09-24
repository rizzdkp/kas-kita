import { and, asc, eq, isNull } from "drizzle-orm";
import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { budgets, categories } from "@/server/db/schema";
import { addDaysKey, monthEndKey, monthStartKey, startOfKey } from "@/server/metrics/_time";
import { budgetStatus, type BudgetStatus } from "@/server/metrics/budget-status";
import type { Metric } from "@/server/metrics/types";
import { expenseByOwnerAndCategory } from "./aggregates";
import { budgetInScope, budgetOwnerIdFromKey } from "./scope";

export interface BudgetWithStatus {
  id: string;
  scopeOwner: string;
  /** Pemilik anggaran; null = Bersama. */
  ownerId: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  month: string;
  amount: bigint;
  isMandatory: boolean;
  version: number;
  spent: bigint;
  status: Metric<BudgetStatus>;
}

/** Anggaran bulan `month` (kunci hari mana pun di bulan itu) beserta terpakai dan statusnya. */
export async function listBudgets(
  viewer: Viewer,
  scope: Scope,
  opts: { month: string; today: string },
  db: DbOrTx = defaultDb,
): Promise<BudgetWithStatus[]> {
  const month = monthStartKey(opts.month);
  const rows = await db
    .select({
      id: budgets.id,
      scopeOwner: budgets.scopeOwner,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      month: budgets.month,
      amount: budgets.amount,
      isMandatory: budgets.isMandatory,
      version: budgets.version,
    })
    .from(budgets)
    .innerJoin(categories, eq(categories.id, budgets.categoryId))
    .where(and(eq(budgets.month, month), isNull(budgets.deletedAt), budgetInScope(budgets.scopeOwner, viewer, scope)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  if (rows.length === 0) return [];

  const spending = await expenseByOwnerAndCategory(
    { start: startOfKey(month), end: startOfKey(addDaysKey(monthEndKey(month), 1)) },
    db,
  );
  return rows.map((b) => {
    const ownerId = budgetOwnerIdFromKey(b.scopeOwner);
    let spent = 0n;
    for (const s of spending) {
      if (s.ownerId === ownerId && (s.categoryId === b.categoryId || s.parentId === b.categoryId)) spent += s.amount;
    }
    return {
      ...b,
      ownerId,
      spent,
      status: budgetStatus({ amount: b.amount, spent, month, today: opts.today }),
    };
  });
}
