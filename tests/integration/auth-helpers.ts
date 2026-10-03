import { createHmac } from "node:crypto";
import { sql } from "@/server/db/client";
import { auth } from "@/server/auth/auth";

export async function resetAuthTables(): Promise<void> {
  await sql`TRUNCATE users, login_attempts, verifications CASCADE`;
}

// format cookie bertanda tangan better-call: nilai.base64(HMAC-SHA256), lalu di-URL-encode
function signedCookie(name: string, value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return `${name}=${encodeURIComponent(`${value}.${signature}`)}`;
}

// sesi dibuat langsung lewat adapter internal, lalu cookie ditandatangani seperti yang dilakukan Better Auth
export async function sessionHeadersFor(userId: string, extra: Record<string, string> = {}): Promise<Headers> {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(userId);
  const cookie = signedCookie(context.authCookies.sessionToken.name, session.token, context.secret);
  return new Headers({ cookie, "x-forwarded-for": "10.0.0.9", ...extra });
}

export interface ParsedSetCookie {
  name: string;
  value: string;
  maxAge: number | null;
}

export function parseSetCookies(response: Headers | null | undefined): ParsedSetCookie[] {
  return (response?.getSetCookie() ?? []).map((setCookie) => {
    const [pair = "", ...attrs] = setCookie.split(";");
    const [name = "", ...rest] = pair.trim().split("=");
    const maxAgeAttr = attrs.map((a) => a.trim()).find((a) => /^max-age=/i.test(a));
    return { name, value: rest.join("="), maxAge: maxAgeAttr ? Number(maxAgeAttr.split("=")[1]) : null };
  });
}

export function mergeSetCookies(base: Headers, response: Headers | null | undefined): Headers {
  const jar = new Map<string, string>();
  for (const part of (base.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) jar.set(name, rest.join("="));
  }
  for (const cookie of parseSetCookies(response)) {
    if (cookie.maxAge === 0) jar.delete(cookie.name);
    else jar.set(cookie.name, cookie.value);
  }
  const headers = new Headers(base);
  headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  return headers;
}
