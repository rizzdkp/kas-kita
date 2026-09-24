import { eq, isNull, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/** Pengenalan UX-FLOWS 11 muncul sampai pengguna menyelesaikan atau melewatinya. */
export function needsOnboarding(viewer: Viewer): boolean {
  return viewer.user.onboardedAt === null;
}

/** Pengguna kedua cukup mengisi profil kalau akun rumah tangga sudah dibuat pengguna pertama. */
export async function hasHouseholdAccounts(db: DbOrTx = defaultDb): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.accounts)
    .where(isNull(schema.accounts.deletedAt));
  return (row?.n ?? 0) > 0;
}

// tabel rumah tangga yang ikut ekspor; kredensial, sesi, dan kunci AI sengaja tidak ada
const EXPORT_TABLES = {
  institutions: schema.institutions,
  accounts: schema.accounts,
  categories: schema.categories,
  transactions: schema.transactions,
  transaction_splits: schema.transactionSplits,
  tags: schema.tags,
  transaction_tags: schema.transactionTags,
  attachments: schema.attachments,
  investment_valuations: schema.investmentValuations,
  recurring_rules: schema.recurringRules,
  bills: schema.bills,
  bill_payments: schema.billPayments,
  budgets: schema.budgets,
  goals: schema.goals,
  goal_contributions: schema.goalContributions,
  import_batches: schema.importBatches,
  import_rows: schema.importRows,
  import_templates: schema.importTemplates,
  insights: schema.insights,
  audit_log: schema.auditLog,
} satisfies Record<string, PgTable>;

export type ExportTableName = keyof typeof EXPORT_TABLES | "users" | "ai_settings" | "notifications";

export interface HouseholdExport {
  format: "kas-kita-export";
  version: 1;
  exportedAt: string;
  exportedBy: string;
  tables: Record<ExportTableName, Array<Record<string, unknown>>>;
}

export async function exportHouseholdData(viewer: Viewer, db: DbOrTx = defaultDb, now: Date = new Date()): Promise<HouseholdExport> {
  const tables = {} as HouseholdExport["tables"];
  for (const [name, table] of Object.entries(EXPORT_TABLES)) {
    tables[name as keyof typeof EXPORT_TABLES] = (await db.select().from(table as PgTable)) as Array<Record<string, unknown>>;
  }
  tables.users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      identityColor: schema.users.identityColor,
      paydayDay: schema.users.paydayDay,
      periodMode: schema.users.periodMode,
      onboardedAt: schema.users.onboardedAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);
  tables.ai_settings = await db
    .select({
      id: schema.aiSettings.id,
      baseUrl: schema.aiSettings.baseUrl,
      textModel: schema.aiSettings.textModel,
      visionModel: schema.aiSettings.visionModel,
      updatedAt: schema.aiSettings.updatedAt,
    })
    .from(schema.aiSettings);
  tables.notifications = await db.select().from(schema.notifications).where(eq(schema.notifications.recipientId, viewer.user.id));
  return { format: "kas-kita-export", version: 1, exportedAt: now.toISOString(), exportedBy: viewer.user.displayName, tables };
}

/** JSON dengan bigint sebagai string digit supaya nominal tidak kehilangan presisi. */
export function serializeExport(data: HouseholdExport): string {
  return JSON.stringify(data, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2);
}
