import { z } from "zod";
import { TRUSTED_SESSION_SECONDS, UNTRUSTED_SESSION_SECONDS } from "./constants";

const SIGN_IN_PATH = "/sign-in/email";
const rememberBody = z.object({ rememberMe: z.boolean().optional() });

interface SessionCreateContext {
  path?: string | undefined;
  body?: unknown;
  context?: { session?: { session?: { trusted?: unknown } } | null } | undefined;
}

// tanpa centang "Ingat perangkat ini" yang eksplisit, perangkat dianggap tidak tepercaya
export function isTrustedSessionRequest(ctx: SessionCreateContext | null | undefined): boolean {
  if (!ctx) return false;
  if (ctx.path === SIGN_IN_PATH) {
    const parsed = rememberBody.safeParse(ctx.body);
    return parsed.success && parsed.data.rememberMe === true;
  }
  // sesi pengganti (mis. setelah ganti password) mewarisi status sesi yang sedang dipakai
  return ctx.context?.session?.session?.trusted === true;
}

export function sessionExpiresAt(trusted: boolean, now: Date = new Date()): Date {
  const seconds = trusted ? TRUSTED_SESSION_SECONDS : UNTRUSTED_SESSION_SECONDS;
  return new Date(now.getTime() + seconds * 1000);
}

// sesi tidak tepercaya tidak pernah diperpanjang melewati 12 jam sejak dibuat
export function capUntrustedExpiry(createdAt: Date, requested: Date): Date {
  const cap = sessionExpiresAt(false, createdAt);
  return requested > cap ? cap : requested;
}
