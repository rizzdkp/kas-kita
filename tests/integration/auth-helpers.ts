import { createHmac } from "node:crypto";
import { sql } from "@/server/db/client";
import { auth } from "@/server/auth/auth";
import { REMEMBER_DEVICE_COOKIE } from "@/server/auth/constants";

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

export function mergeSetCookies(base: Headers, response: Headers | null | undefined, remember?: boolean): Headers {
  const jar = new Map<string, string>();
  for (const part of (base.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) jar.set(name, rest.join("="));
  }
  for (const setCookie of response?.getSetCookie() ?? []) {
    const [pair = "", ...attrs] = setCookie.split(";");
    const [name = "", ...rest] = pair.trim().split("=");
    const expired = attrs.some((a) => /max-age=0\b/i.test(a.trim()));
    if (expired) jar.delete(name);
    else jar.set(name, rest.join("="));
  }
  if (remember !== undefined) jar.set(REMEMBER_DEVICE_COOKIE, remember ? "1" : "0");
  const headers = new Headers(base);
  headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  return headers;
}

// secret di otpauth URI berbentuk base32, sedangkan generateTOTP menerima secret mentah
function decodeBase32(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes).toString("utf8");
}

export async function totpCode(base32Secret: string): Promise<string> {
  const { code } = await auth.api.generateTOTP({ body: { secret: decodeBase32(base32Secret) } });
  return code;
}

// menyetel password + TOTP seperti halaman daftar perangkat, lalu mengembalikan secret TOTP
export async function enableBackupLogin(userId: string, password: string): Promise<string> {
  const headers = await sessionHeadersFor(userId);
  await auth.api.setPassword({ body: { newPassword: password }, headers });
  const enabled = await auth.api.enableTwoFactor({ body: { password, method: "totp" }, headers });
  if (!("totpURI" in enabled) || !enabled.totpURI) throw new Error("totpURI kosong");
  const secret = new URL(enabled.totpURI).searchParams.get("secret");
  if (!secret) throw new Error("secret kosong");
  await auth.api.verifyTOTP({ body: { code: await totpCode(secret) }, headers });
  return secret;
}
