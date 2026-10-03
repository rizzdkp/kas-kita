import { DEV_SEED_EMAILS, setDevSeedPasswords } from "@/server/auth/dev-passwords";
import { sql } from "@/server/db/client";

// untuk database yang di-seed sebelum seed menyetel password; seed baru sudah melakukannya sendiri
try {
  await setDevSeedPasswords();
  console.log(`Password ${DEV_SEED_EMAILS.join(" dan ")} disetel dari DEV_SEED_PASSWORD (bawaan kaskita-dev-123).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Gagal menyetel password user seed.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
