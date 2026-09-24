import { REMEMBER_DEVICE_COOKIE, TRUSTED_SESSION_SECONDS, UNTRUSTED_SESSION_SECONDS } from "./constants";

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

// tanpa sinyal eksplisit dari klien, perangkat dianggap tidak tepercaya
export function isRememberRequested(cookieHeader: string | null | undefined): boolean {
  return readCookie(cookieHeader, REMEMBER_DEVICE_COOKIE) === "1";
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
