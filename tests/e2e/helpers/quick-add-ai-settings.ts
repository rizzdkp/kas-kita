import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { saveAiSettings } from "@/server/mutations/ai-settings";
import { getAiSettingsRow } from "@/server/queries/ai-settings";

// hanya untuk e2e quick-add AI: arahkan pengaturan AI rumah tangga ke server palsu lewat mutasi
// baris ai_settings dipakai bersama tes lain, jadi tidak pernah dihapus atau dikembalikan di sini
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

const [command, arg1, arg2] = process.argv.slice(2);
const [rizz] = await db.select().from(users).where(eq(users.email, "rizz@kaskita.local"));
if (!rizz) throw new Error("User seed tidak ada");
const viewer = { user: rizz, partner: null, sessionId: "e2e" };

if (command === "set") {
  const current = await getAiSettingsRow();
  await saveAiSettings(viewer, {
    baseUrl: arg1!,
    apiKey: "sk-e2e-quick-add-0000",
    textModel: arg2 ?? "fake-text",
    visionModel: current?.visionModel ?? null,
    version: current?.version ?? null,
  });
  console.log("ok");
} else {
  throw new Error("perintah: set <baseUrl> [textModel]");
}
await sql.end();
