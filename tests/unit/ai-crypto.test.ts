import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "@/server/crypto";

const key = randomBytes(32);

describe("encryptSecret / decryptSecret", () => {
  it("roundtrip dengan format iv(12) || ciphertext || tag(16)", () => {
    const secret = "sk-proj-abc123-ünïcode";
    const stored = encryptSecret(secret, key);
    expect(stored.length).toBe(12 + Buffer.byteLength(secret) + 16);
    expect(stored.includes(Buffer.from(secret))).toBe(false);
    expect(decryptSecret(stored, key)).toBe(secret);
  });

  it("IV acak: dua enkripsi teks yang sama berbeda", () => {
    const a = encryptSecret("sama", key);
    const b = encryptSecret("sama", key);
    expect(a.subarray(0, 12).equals(b.subarray(0, 12))).toBe(false);
    expect(a.equals(b)).toBe(false);
  });

  it("kunci salah atau data diubah gagal didekripsi", () => {
    const stored = encryptSecret("rahasia", key);
    expect(() => decryptSecret(stored, randomBytes(32))).toThrow();
    const tampered = Buffer.from(stored);
    tampered[14] = tampered[14]! ^ 0xff;
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(Buffer.alloc(10), key)).toThrow();
  });
});

describe("parseEncryptionKey", () => {
  it("menerima 32 byte base64", () => {
    expect(parseEncryptionKey(key.toString("base64")).equals(key)).toBe(true);
  });

  it("menolak kosong dan panjang lain dengan pesan jelas", () => {
    expect(() => parseEncryptionKey(undefined)).toThrow(/APP_ENCRYPTION_KEY belum diisi/);
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/harus 32 byte.*16 byte/);
    expect(() => parseEncryptionKey(randomBytes(33).toString("base64"), "APP_ENCRYPTION_KEY_OLD")).toThrow(/APP_ENCRYPTION_KEY_OLD harus 32 byte/);
  });
});
