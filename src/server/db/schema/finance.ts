import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { id, softDelete, timestamps, versioned } from "./common";
import { users } from "./users";

export const ACCOUNT_TYPES = ["bank", "ewallet", "cash", "credit_card", "paylater", "loan", "investment", "other_asset"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const institutions = pgTable("institutions", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: text("kind").$type<"bank" | "ewallet" | "other">().notNull(),
  ...timestamps,
});

export const accounts = pgTable("accounts", {
  id: id(),
  ownerId: uuid("owner_id").references(() => users.id),
  name: text("name").notNull(),
  type: text("type").$type<AccountType>().notNull(),
  institutionId: uuid("institution_id").references(() => institutions.id),
  openingBalance: bigint("opening_balance", { mode: "bigint" }).notNull().default(sql`0`),
  openingDate: date("opening_date").notNull(),
  allowNegative: boolean("allow_negative").notNull().default(false),
  creditLimit: bigint("credit_limit", { mode: "bigint" }),
  statementDay: smallint("statement_day"),
  dueDay: smallint("due_day"),
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  ...versioned,
  ...softDelete,
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").$type<"income" | "expense" | "system">().notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
  icon: text("icon").notNull().default("circle"),
  isSystem: boolean("is_system").notNull().default(false),
  // kunci stabil untuk kategori sistem: "adjustment", "transfer"
  systemKey: text("system_key").unique(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  ...versioned,
  ...softDelete,
  ...timestamps,
});

export const TRANSACTION_KINDS = ["income", "expense", "transfer"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type Beneficiary = "owner" | "partner_of_owner" | "shared";
export type TransactionSource = "manual" | "quick_add" | "receipt" | "import_csv" | "import_pdf" | "recurring" | "adjustment";

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    kind: text("kind").$type<TransactionKind>().notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    toAccountId: uuid("to_account_id").references(() => accounts.id),
    categoryId: uuid("category_id").references(() => categories.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    note: text("note"),
    beneficiary: text("beneficiary").$type<Beneficiary>().notNull().default("owner"),
    status: text("status").$type<"confirmed" | "draft">().notNull().default("confirmed"),
    source: text("source").$type<TransactionSource>().notNull().default("manual"),
    recurringId: uuid("recurring_id"),
    importRowId: uuid("import_row_id"),
    clientId: text("client_id").unique(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    updatedBy: uuid("updated_by").notNull().references(() => users.id),
    ...versioned,
    ...softDelete,
    ...timestamps,
  },
  (t) => [
    index("transactions_account_occurred_idx").on(t.accountId, t.occurredAt.desc()),
    index("transactions_to_account_occurred_idx").on(t.toAccountId, t.occurredAt.desc()),
    index("transactions_category_occurred_idx").on(t.categoryId, t.occurredAt),
    index("transactions_occurred_idx").on(t.occurredAt),
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check(
      "transactions_kind_shape",
      sql`(${t.kind} = 'transfer' and ${t.toAccountId} is not null and ${t.toAccountId} <> ${t.accountId} and ${t.categoryId} is null)
        or (${t.kind} <> 'transfer' and ${t.toAccountId} is null and ${t.categoryId} is not null)`,
    ),
  ],
);

export const transactionSplits = pgTable("transaction_splits", {
  id: id(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  note: text("note"),
  ...versioned,
  ...timestamps,
});

export const tags = pgTable("tags", {
  id: id(),
  name: text("name").notNull().unique(),
  ...timestamps,
});

export const transactionTags = pgTable(
  "transaction_tags",
  {
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.transactionId, t.tagId] })],
);

export const attachments = pgTable("attachments", {
  id: id(),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  ...versioned,
  ...softDelete,
  ...timestamps,
});

export const investmentValuations = pgTable("investment_valuations", {
  id: id(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  valuedOn: date("valued_on").notNull(),
  marketValue: bigint("market_value", { mode: "bigint" }).notNull(),
  note: text("note"),
  ...versioned,
  ...softDelete,
  ...timestamps,
});
