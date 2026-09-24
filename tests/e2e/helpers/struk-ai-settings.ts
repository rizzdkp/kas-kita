import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import { aiSettings, users } from "@/server/db/schema";
import { saveAiSettings } from "@/server/mutations/ai-settings";
import { getAiSettingsRow } from "@/server/queries/ai-settings";

// hanya untuk e2e foto struk: pasang model vision ke server palsu lewat mutasi, lalu kembalikan seperti semula
// set <baseUrl> → mencetak snapshot (key tetap terenkripsi); restore <snapshot>
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

type Snapshot = {
  baseUrl: string;
  apiKeyCiphertext: string | null;
  apiKeyLast4: string | null;
  textModel: string | null;
  visionModel: string | null;
  supportsJsonSchema: boolean | null;
} | null;

const [command, arg] = process.argv.slice(2);
const [rizz] = await db.select().from(users).where(eq(users.email, "rizz@kaskita.local"));
if (!rizz) throw new Error("User seed tidak ada");
const viewer = { user: rizz, partner: null, sessionId: "e2e" };

if (command === "set") {
  const current = await getAiSettingsRow();
  const snapshot: Snapshot = current
    ? {
        baseUrl: current.baseUrl,
        apiKeyCiphertext: current.apiKeyCiphertext ? Buffer.from(current.apiKeyCiphertext).toString("base64") : null,
        apiKeyLast4: current.apiKeyLast4,
        textModel: current.textModel,
        visionModel: current.visionModel,
        supportsJsonSchema: current.supportsJsonSchema,
      }
    : null;
  await saveAiSettings(viewer, {
    baseUrl: arg!,
    apiKey: "sk-e2e-struk-0000",
    textModel: "fake-text",
    visionModel: "fake-vision",
    version: current?.version ?? null,
  });
  console.log(JSON.stringify(snapshot));
} else if (command === "restore") {
  const snapshot = JSON.parse(arg ?? "null") as Snapshot;
  const current = await getAiSettingsRow();
  // baris dipakai bersama agen dan tes lain: tanpa snapshot, baris dibiarkan, tidak dihapus
  if (snapshot && current) {
    await db
      .update(aiSettings)
      .set({
        baseUrl: snapshot.baseUrl,
        apiKeyCiphertext: snapshot.apiKeyCiphertext ? Buffer.from(snapshot.apiKeyCiphertext, "base64") : null,
        apiKeyLast4: snapshot.apiKeyLast4,
        textModel: snapshot.textModel,
        visionModel: snapshot.visionModel,
        supportsJsonSchema: snapshot.supportsJsonSchema,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, current.id));
  }
  console.log("ok");
} else {
  throw new Error("perintah: set <baseUrl> | restore <snapshot>");
}
await sql.end();
