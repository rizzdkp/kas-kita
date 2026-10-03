import { and, isNull, sql as dsql } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import { recurringRules } from "@/server/db/schema";
import { handleRecurringDraftsJob } from "@/worker/jobs/recurring";

// hanya untuk e2e: jalankan job recurring.create-drafts untuk jadwal ber-catatan tertentu, bukan semua jadwal di DB dev
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

const note = process.argv[2];
if (!note) throw new Error("catatan jadwal wajib diisi");
const rules = await db
  .select({ id: recurringRules.id })
  .from(recurringRules)
  .where(and(isNull(recurringRules.deletedAt), dsql`${recurringRules.template}->>'note' = ${note}`));
const result = await handleRecurringDraftsJob({ ruleIds: rules.map((r) => r.id), push: false });
console.log(JSON.stringify(result));
await sql.end();
