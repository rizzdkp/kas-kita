import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createHousehold, type Household } from "../helpers/fixtures";
import { aiSettings, auditLog } from "@/server/db/schema";
import { getAiConfig } from "@/server/ai/client";
import { decryptSecret, parseEncryptionKey } from "@/server/crypto";
import { ConflictError, ValidationError } from "@/server/errors";
import { deleteAiSettings, saveAiSettings } from "@/server/mutations/ai-settings";
import { getAiSettingsView } from "@/server/queries/ai-settings";

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const KEY_A = "sk-pertama-abcd";
const KEY_B = "sk-kedua-wxyz";
let h: Household;

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
});

afterAll(closeDb);

async function audits() {
  return testDb.select().from(auditLog).where(eq(auditLog.entity, "ai_settings")).orderBy(auditLog.at, auditLog.id);
}

const first = { baseUrl: "https://api.contoh.test/v1/", apiKey: KEY_A, textModel: "teks-1", visionModel: "", version: null };

describe("saveAiSettings", () => {
  it("menyimpan key terenkripsi dan hanya 4 karakter terakhir yang terbaca di view", async () => {
    const row = await saveAiSettings(h.rizz, first, testDb);
    expect(row.baseUrl).toBe("https://api.contoh.test/v1");
    expect(row.apiKeyCiphertext!.includes(Buffer.from(KEY_A))).toBe(false);
    expect(decryptSecret(row.apiKeyCiphertext!)).toBe(KEY_A);

    const view = await getAiSettingsView(testDb);
    expect(view).toMatchObject({ apiKeyLast4: "abcd", textModel: "teks-1", visionModel: null, version: 1, updatedByName: "Rizz" });
    expect(JSON.stringify(view)).not.toContain(KEY_A);
    expect(view).not.toHaveProperty("apiKeyCiphertext");
  });

  it("audit insert dan update tanpa key atau ciphertext, key dicatat sebagai ••••last4", async () => {
    const created = await saveAiSettings(h.rizz, first, testDb);
    await saveAiSettings(h.nadia, { ...first, apiKey: KEY_B, textModel: "teks-2", version: created.version }, testDb);

    const log = await audits();
    expect(log.map((a) => a.action)).toEqual(["insert", "update"]);
    expect(log[1]!.actorId).toBe(h.nadia.user.id);
    expect(log[1]!.diff).toEqual({ api_key: ["••••abcd", "••••wxyz"], text_model: ["teks-1", "teks-2"] });
    expect(log[0]!.diff).toMatchObject({ base_url: [null, "https://api.contoh.test/v1"], api_key: [null, "••••abcd"] });
    const all = JSON.stringify(log);
    for (const secret of [KEY_A, KEY_B, "api_key_ciphertext", "api_key_last4"]) expect(all).not.toContain(secret);
  });

  it("key kosong saat mengubah = key lama tetap, dan konfigurasi berlaku untuk partner", async () => {
    const created = await saveAiSettings(h.rizz, first, testDb);
    await saveAiSettings(h.nadia, { ...first, apiKey: "  ", visionModel: "vision-1", version: created.version }, testDb);
    const config = await getAiConfig(testDb);
    expect(config).toMatchObject({ apiKey: KEY_A, visionModel: "vision-1" });
    const log = await audits();
    expect(log[1]!.diff).toEqual({ vision_model: [null, "vision-1"] });
  });

  it("mengganti base URL atau model mereset supports_json_schema", async () => {
    const created = await saveAiSettings(h.rizz, first, testDb);
    await testDb.update(aiSettings).set({ supportsJsonSchema: true });
    await saveAiSettings(h.rizz, { ...first, apiKey: "", baseUrl: "http://localhost:4011/v1", version: created.version }, testDb);
    const [row] = await testDb.select().from(aiSettings);
    expect(row!.supportsJsonSchema).toBeNull();
  });

  it("menolak versi lama, key kosong saat pertama kali, dan base URL tanpa http", async () => {
    const created = await saveAiSettings(h.rizz, first, testDb);
    await saveAiSettings(h.rizz, { ...first, apiKey: "", version: created.version }, testDb);
    await expect(saveAiSettings(h.nadia, { ...first, version: created.version }, testDb)).rejects.toBeInstanceOf(ConflictError);
    await resetDb();
    h = await createHousehold(testDb);
    await expect(saveAiSettings(h.rizz, { ...first, apiKey: "" }, testDb)).rejects.toMatchObject({ fieldErrors: { apiKey: [expect.any(String)] } });
    await expect(saveAiSettings(h.rizz, { ...first, baseUrl: "ftp://x" }, testDb)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("deleteAiSettings", () => {
  it("menghapus baris sehingga AI mati, riwayat mencatat penghapusan tanpa key", async () => {
    const created = await saveAiSettings(h.rizz, first, testDb);
    await deleteAiSettings(h.nadia, { version: created.version }, testDb);
    expect(await getAiConfig(testDb)).toBeNull();
    expect(await getAiSettingsView(testDb)).toBeNull();
    const log = await audits();
    expect(log.at(-1)).toMatchObject({ action: "delete", actorId: h.nadia.user.id });
    expect(log.at(-1)!.diff).toMatchObject({ api_key: ["••••abcd", null], base_url: ["https://api.contoh.test/v1", null] });
    expect(JSON.stringify(log)).not.toContain(KEY_A);
  });
});

describe("scripts/rotate-key.ts", () => {
  it("mengenkripsi ulang key dengan kunci baru", async () => {
    const oldKey = process.env.APP_ENCRYPTION_KEY!;
    await saveAiSettings(h.rizz, first, testDb);
    const newKey = randomBytes(32).toString("base64");
    execFileSync("npx", ["tsx", "scripts/rotate-key.ts"], {
      env: { ...process.env, APP_ENCRYPTION_KEY_OLD: oldKey, APP_ENCRYPTION_KEY: newKey, DATABASE_MIGRATION_URL: process.env.DATABASE_URL },
      encoding: "utf8",
    });
    const [row] = await testDb.select().from(aiSettings);
    expect(decryptSecret(row!.apiKeyCiphertext!, parseEncryptionKey(newKey))).toBe(KEY_A);
    expect(() => decryptSecret(row!.apiKeyCiphertext!, parseEncryptionKey(oldKey))).toThrow();
  }, 60_000);
});
