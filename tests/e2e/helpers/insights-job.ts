import { asc } from "drizzle-orm";
import { todayJakarta } from "@/lib/dates";
import { db, sql } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { runWeeklyInsights } from "@/server/insights/generate";
import { ALL_SCOPE_KEY, personalScopeKey } from "@/server/insights/scope-key";
import { summarizedWeekStart } from "@/server/insights/week";
import { deleteWeeklyInsights } from "@/server/mutations/insights";

// hanya untuk e2e wawasan: jalankan job insights.weekly sekarang, atau hapus hasilnya minggu ini
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

const [command] = process.argv.slice(2);
if (command === "run") {
  const run = await runWeeklyInsights();
  console.log(JSON.stringify(run));
} else if (command === "clear") {
  const people = await db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt));
  const keys = [...people.map((p) => personalScopeKey(p.id)), ALL_SCOPE_KEY];
  console.log(JSON.stringify({ removed: await deleteWeeklyInsights(keys, summarizedWeekStart(todayJakarta())) }));
} else {
  throw new Error("perintah: run | clear");
}
await sql.end();
