import { z } from "zod";

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// kunci VAPID base64url: publik 65 byte (87 karakter), privat 32 byte (43 karakter)
const vapidSchema = z.object({
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
  privateKey: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/),
  subject: z.string().regex(/^(mailto:|https:\/\/)/),
});

/** Kunci VAPID dari env; null berarti web push mati dan UI-nya disembunyikan. */
type VapidEnv = Record<string, string | undefined>;

export function getVapidConfig(env: VapidEnv = process.env): VapidConfig | null {
  const parsed = vapidSchema.safeParse({
    publicKey: env.VAPID_PUBLIC_KEY?.trim(),
    privateKey: env.VAPID_PRIVATE_KEY?.trim(),
    subject: env.VAPID_SUBJECT?.trim(),
  });
  return parsed.success ? parsed.data : null;
}

export function isPushConfigured(env: VapidEnv = process.env): boolean {
  return getVapidConfig(env) !== null;
}
