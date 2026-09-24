import { eq } from "drizzle-orm";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx, isAPIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { clearFailedLogins, getLoginLock, lockMessage, recordFailedLogin, type LoginIdentity } from "./rate-limit";

const PASSWORD_PATH = "/sign-in/email";
const TOTP_PATH = "/two-factor/verify-totp";
const PASSKEY_LOGIN_PATH = "/passkey/verify-authentication";
const PASSKEY_REGISTER_PATH = "/passkey/verify-registration";

export const INVALID_CREDENTIALS_MESSAGE = "Email atau password salah.";
export const INVALID_TOTP_MESSAGE = "Kode dari aplikasi autentikator salah. Cek jam di ponselmu lalu coba lagi.";

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

const emailBody = z.object({ email: z.string() });

function clientIp(ctx: HookContext): string | null {
  const source = ctx.request ?? ctx.headers;
  return source ? getIP(source, ctx.context.options) : null;
}

// email pengguna yang sedang di langkah TOTP, dibaca dari cookie tantangan plugin twoFactor
async function pendingTwoFactorEmail(ctx: HookContext): Promise<string | null> {
  const cookie = ctx.context.createAuthCookie("two_factor");
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!identifier) return null;
  const verification = await ctx.context.internalAdapter.findVerificationValue(identifier);
  if (!verification) return null;
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, verification.value)).limit(1);
  return user?.email ?? null;
}

async function identityFor(ctx: HookContext): Promise<LoginIdentity> {
  const ip = clientIp(ctx);
  if (ctx.path === PASSWORD_PATH) {
    const parsed = emailBody.safeParse(ctx.body);
    return { ip, email: parsed.success ? parsed.data.email : null };
  }
  if (ctx.path === TOTP_PATH) return { ip, email: await pendingTwoFactorEmail(ctx) };
  return { ip };
}

async function failAndMaybeLock(identity: LoginIdentity, message: string, code: string): Promise<never> {
  const lock = await recordFailedLogin(identity);
  if (lock) throw new APIError("TOO_MANY_REQUESTS", { message: lockMessage(lock), code: "LOGIN_LOCKED" });
  throw new APIError("UNAUTHORIZED", { message, code });
}

export const beforeAuthHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== PASSWORD_PATH && ctx.path !== TOTP_PATH && ctx.path !== PASSKEY_LOGIN_PATH) return;
  // verifikasi TOTP saat menyetel cadangan (sudah punya sesi) bukan percobaan login
  if (ctx.path === TOTP_PATH && (await getSessionFromCtx(ctx))) return;
  const identity = await identityFor(ctx);
  const lock = await getLoginLock(identity);
  if (lock) throw new APIError("TOO_MANY_REQUESTS", { message: lockMessage(lock), code: "LOGIN_LOCKED" });
  if (ctx.path !== PASSWORD_PATH || !identity.email) return;
  // password tanpa TOTP aktif tidak boleh dipakai masuk (SECURITY.md)
  const [user] = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.email, identity.email.trim().toLowerCase()))
    .limit(1);
  if (user && !user.twoFactorEnabled) await failAndMaybeLock(identity, INVALID_CREDENTIALS_MESSAGE, "INVALID_EMAIL_OR_PASSWORD");
});

export const afterAuthHook = createAuthMiddleware(async (ctx) => {
  const returned = ctx.context.returned;
  if (ctx.path === PASSWORD_PATH || ctx.path === TOTP_PATH) {
    if (isAPIError(returned)) {
      const code = typeof returned.body?.code === "string" ? returned.body.code : "";
      if (code === "LOGIN_LOCKED") return;
      if (returned.statusCode === 401 || code === "INVALID_CODE" || code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
        if (ctx.path === TOTP_PATH) {
          if (await getSessionFromCtx(ctx)) throw new APIError("UNAUTHORIZED", { message: INVALID_TOTP_MESSAGE, code: "INVALID_CODE" });
          await failAndMaybeLock(await identityFor(ctx), INVALID_TOTP_MESSAGE, "INVALID_CODE");
        }
        await failAndMaybeLock(await identityFor(ctx), INVALID_CREDENTIALS_MESSAGE, "INVALID_EMAIL_OR_PASSWORD");
      }
      return;
    }
    const email = ctx.context.newSession?.user.email;
    if (ctx.path === TOTP_PATH && email) await clearFailedLogins(email);
    return;
  }
  if (ctx.path === PASSKEY_LOGIN_PATH || ctx.path === PASSKEY_REGISTER_PATH) {
    const created = ctx.context.newSession;
    // endpoint passkey selalu memasang cookie 30 hari; perangkat tidak tepercaya diganti cookie sesi browser
    if (created && created.session.trusted !== true) await setSessionCookie(ctx, created, true);
  }
});
