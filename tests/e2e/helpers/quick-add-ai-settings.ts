import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import { aiSettings, users } from "@/server/db/schema";
import { deleteAiSettings, saveAiSettings } from "@/server/mutations/ai-settings";
import { getAiSettingsRow } from "@/server/queries/ai-settings";

// hanya untuk e2e quick-add AI: pasang pengaturan AI ke server palsu lewat mutasi, lalu kembalikan seperti semula
// set <baseUrl> <textModel> → mencetak snapshot (key tetap terenkripsi); restore <snapshot>
if (process.env.NODE_ENV === "production") throw new Error("helper e2e tidak boleh dipakai di produksi");

type Snapshot = {
  baseUrl: string;
  apiKeyCiphertext: string | null;
  apiKeyLast4: string | null;
  textModel: string | null;
  visionModel: string | null;
  supportsJsonSchema: boolean | null;
} | null;

const [command, arg1, arg2] = process.argv.slice(2);
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
    baseUrl: arg1!,
    apiKey: "sk-e2e-quick-add-0000",
    textModel: arg2 ?? "fake-text",
    visionModel: current?.visionModel ?? null,
    version: current?.version ?? null,
  });
  console.log(JSON.stringify(snapshot));
} else if (command === "restore") {
  const snapshot = JSON.parse(arg1 ?? "null") as Snapshot;
  const current = await getAiSettingsRow();
  if (!snapshot) {
    if (current) await deleteAiSettings(viewer, { version: current.version });
  } else if (current) {
    // ciphertext lama dikembalikan apa adanya; key tidak pernah didekripsi di helper ini
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
  throw new Error("perintah: set <baseUrl> [textModel] | restore <snapshot>");
}
await sql.end();
