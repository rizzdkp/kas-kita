import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM (SECURITY.md bagian 2): disimpan iv || ciphertext || tag
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** Kunci 32 byte dari string base64; panjang lain ditolak supaya salah konfigurasi ketahuan saat start. */
export function parseEncryptionKey(base64: string | undefined, envName = "APP_ENCRYPTION_KEY"): Buffer {
  if (!base64) throw new Error(`${envName} belum diisi. Buat dengan: openssl rand -base64 32`);
  const key = Buffer.from(base64.trim(), "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`${envName} harus 32 byte dalam base64 (sekarang ${key.length} byte). Buat dengan: openssl rand -base64 32`);
  }
  return key;
}

function defaultKey(): Buffer {
  return parseEncryptionKey(process.env.APP_ENCRYPTION_KEY);
}

export function encryptSecret(plaintext: string, key: Buffer = defaultKey()): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
}

/** Melempar bila kunci salah atau data diubah (tag GCM tidak cocok). */
export function decryptSecret(stored: Buffer | Uint8Array, key: Buffer = defaultKey()): string {
  const buf = Buffer.from(stored);
  if (buf.length < IV_BYTES + TAG_BYTES) throw new Error("Data terenkripsi terlalu pendek");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
