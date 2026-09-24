import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "../src/server/crypto";
import * as schema from "../src/server/db/schema";

// rotasi kunci (SECURITY 2): dekripsi dengan APP_ENCRYPTION_KEY_OLD, enkripsi ulang dengan APP_ENCRYPTION_KEY
// pemakaian: APP_ENCRYPTION_KEY_OLD=<lama> APP_ENCRYPTION_KEY=<baru> DATABASE_URL=... npx tsx scripts/rotate-key.ts
async function main(): Promise<void> {
  const oldKey = parseEncryptionKey(process.env.APP_ENCRYPTION_KEY_OLD, "APP_ENCRYPTION_KEY_OLD");
  const newKey = parseEncryptionKey(process.env.APP_ENCRYPTION_KEY, "APP_ENCRYPTION_KEY");
  if (oldKey.equals(newKey)) throw new Error("APP_ENCRYPTION_KEY_OLD dan APP_ENCRYPTION_KEY sama; tidak ada yang dirotasi");
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  try {
    const count = await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: schema.aiSettings.id, ciphertext: schema.aiSettings.apiKeyCiphertext })
        .from(schema.aiSettings)
        .where(isNotNull(schema.aiSettings.apiKeyCiphertext))
        .for("update");
      for (const row of rows) {
        // satu baris gagal didekripsi membatalkan seluruh transaksi, jadi tidak ada campuran kunci lama dan baru
        const plain = decryptSecret(row.ciphertext!, oldKey);
        await tx.update(schema.aiSettings).set({ apiKeyCiphertext: encryptSecret(plain, newKey) }).where(eq(schema.aiSettings.id, row.id));
      }
      return rows.length;
    });
    console.log(`rotate-key: ${count} secret dienkripsi ulang`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((e: unknown) => {
  console.error(`rotate-key gagal: ${e instanceof Error ? e.message : "kesalahan tidak dikenal"}`);
  process.exit(1);
});
