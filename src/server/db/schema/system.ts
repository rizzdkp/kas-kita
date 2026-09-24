import { sql } from "drizzle-orm";
import { boolean, customType, date, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, versioned } from "./common";
import { accounts, institutions, transactions } from "./finance";
import { users } from "./users";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const importBatches = pgTable("import_batches", {
  id: id(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  institutionId: uuid("institution_id").references(() => institutions.id),
  format: text("format").$type<"csv" | "pdf" | "ai_pdf">().notNull(),
  fileSha256: text("file_sha256").notNull(),
  status: text("status").$type<"parsing" | "review" | "committed" | "failed">().notNull().default("parsing"),
  error: text("error"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
});

export const importRows = pgTable(
  "import_rows",
  {
    id: id(),
    batchId: uuid("batch_id").notNull().references(() => importBatches.id, { onDelete: "cascade" }),
    rowHash: text("row_hash").notNull(),
    raw: jsonb("raw").notNull(),
    parsed: jsonb("parsed").notNull(),
    decision: text("decision").$type<"new" | "duplicate_of" | "skip">().notNull().default("new"),
    matchedTransactionId: uuid("matched_transaction_id").references(() => transactions.id),
    ...timestamps,
  },
  (t) => [index("import_rows_hash_idx").on(t.rowHash)],
);

export const importTemplates = pgTable("import_templates", {
  id: id(),
  institutionId: uuid("institution_id").references(() => institutions.id),
  name: text("name").notNull(),
  mapping: jsonb("mapping").notNull(),
  ...versioned,
  ...timestamps,
});

export const aiSettings = pgTable("ai_settings", {
  id: id(),
  baseUrl: text("base_url").notNull(),
  apiKeyCiphertext: bytea("api_key_ciphertext"),
  apiKeyLast4: text("api_key_last4"),
  textModel: text("text_model"),
  visionModel: text("vision_model"),
  supportsJsonSchema: boolean("supports_json_schema"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  ...versioned,
  ...timestamps,
});

export const aiCalls = pgTable("ai_calls", {
  id: id(),
  purpose: text("purpose").$type<"quick_add" | "receipt" | "pdf_extract" | "insight" | "test">().notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms").notNull(),
  ok: boolean("ok").notNull(),
  error: text("error"),
  ...timestamps,
});

export const insights = pgTable("insights", {
  id: id(),
  scope: text("scope").notNull(),
  weekStart: date("week_start").notNull(),
  facts: jsonb("facts").notNull(),
  text: text("text").notNull(),
  sourceTransactionIds: uuid("source_transaction_ids").array().notNull().default(sql`'{}'::uuid[]`),
  generatedBy: text("generated_by").$type<"ai" | "template">().notNull(),
  ...timestamps,
});

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    recipientId: uuid("recipient_id").notNull().references(() => users.id),
    kind: text("kind").$type<"partner_edit" | "bill_due" | "budget_over" | "recurring_pending">().notNull(),
    payload: jsonb("payload").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notifications_recipient_idx").on(t.recipientId, t.createdAt.desc())],
);

// append-only; role aplikasi hanya punya INSERT dan SELECT (lihat migrasi 0001)
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").$type<"insert" | "update" | "delete" | "restore">().notNull(),
    diff: jsonb("diff").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId, t.at.desc())],
);

// rate limit login per IP dan per email (SECURITY.md)
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_at_idx").on(t.key, t.at)],
);

