import { bigint, boolean, date, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { id, softDelete, timestamps, versioned } from "./common";
import { accounts, categories, transactions } from "./finance";
import { users } from "./users";

export const recurringRules = pgTable("recurring_rules", {
  id: id(),
  template: jsonb("template").notNull(),
  rrule: text("rrule").notNull(),
  nextRunOn: date("next_run_on").notNull(),
  autoConfirm: boolean("auto_confirm").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...versioned,
  ...softDelete,
  ...timestamps,
});

export const bills = pgTable("bills", {
  id: id(),
  ownerId: uuid("owner_id").references(() => users.id),
  name: text("name").notNull(),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  amountIsEstimate: boolean("amount_is_estimate").notNull().default(false),
  payFromAccountId: uuid("pay_from_account_id").notNull().references(() => accounts.id),
  categoryId: uuid("category_id").references(() => categories.id),
  creditCardAccountId: uuid("credit_card_account_id").references(() => accounts.id),
  rrule: text("rrule").notNull(),
  nextDueOn: date("next_due_on").notNull(),
  ...versioned,
  ...softDelete,
  ...timestamps,
});

export const billPayments = pgTable(
  "bill_payments",
  {
    id: id(),
    billId: uuid("bill_id").notNull().references(() => bills.id),
    periodStart: date("period_start").notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [unique("bill_payments_bill_period_uq").on(t.billId, t.periodStart)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    // "user:<uuid>" atau "shared"
    scopeOwner: text("scope_owner").notNull(),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    month: date("month").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    isMandatory: boolean("is_mandatory").notNull().default(false),
    ...versioned,
    ...softDelete,
    ...timestamps,
  },
  (t) => [unique("budgets_scope_category_month_uq").on(t.scopeOwner, t.categoryId, t.month)],
);

export const goals = pgTable("goals", {
  id: id(),
  ownerId: uuid("owner_id").references(() => users.id),
  name: text("name").notNull(),
  targetAmount: bigint("target_amount", { mode: "bigint" }).notNull(),
  deadline: date("deadline"),
  linkedAccountId: uuid("linked_account_id").references(() => accounts.id),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
  ...versioned,
  ...softDelete,
  ...timestamps,
});

export const goalContributions = pgTable("goal_contributions", {
  id: id(),
  goalId: uuid("goal_id").notNull().references(() => goals.id),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  contributedAt: timestamp("contributed_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...versioned,
  ...softDelete,
  ...timestamps,
});
