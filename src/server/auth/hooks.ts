import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { z } from "zod";
import { clearFailedLogins, getLoginLock, lockMessage, recordFailedLogin, type LoginIdentity } from "./rate-limit";

const PASSWORD_PATH = "/sign-in/email";

export const INVALID_CREDENTIALS_MESSAGE = "Email atau password salah. Cek lagi lalu coba lagi.";

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

const emailBody = z.object({ email: z.string() });

function identityFor(ctx: HookContext): LoginIdentity {
  const source = ctx.request ?? ctx.headers;
  const ip = source ? getIP(source, ctx.context.options) : null;
  const parsed = emailBody.safeParse(ctx.body);
  return { ip, email: parsed.success ? parsed.data.email : null };
}

export const beforeAuthHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== PASSWORD_PATH) return;
  const lock = await getLoginLock(identityFor(ctx));
  if (lock) throw new APIError("TOO_MANY_REQUESTS", { message: lockMessage(lock), code: "LOGIN_LOCKED" });
});

// hanya email atau password salah yang dihitung; body tidak valid atau kunci aktif tidak menambah hitungan
export const afterAuthHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== PASSWORD_PATH) return;
  const returned = ctx.context.returned;
  if (isAPIError(returned)) {
    if (returned.statusCode !== 401) return;
    const lock = await recordFailedLogin(identityFor(ctx));
    if (lock) throw new APIError("TOO_MANY_REQUESTS", { message: lockMessage(lock), code: "LOGIN_LOCKED" });
    throw new APIError("UNAUTHORIZED", { message: INVALID_CREDENTIALS_MESSAGE, code: "INVALID_EMAIL_OR_PASSWORD" });
  }
  const email = ctx.context.newSession?.user.email;
  if (email) await clearFailedLogins(email);
});
