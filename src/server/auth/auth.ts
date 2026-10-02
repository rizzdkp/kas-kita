import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { uuidv7 } from "@/lib/uuid";
import { db } from "@/server/db/client";
import { authAccounts, sessions, users, verifications } from "@/server/db/schema";
import { AUTH_COOKIE_PREFIX, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, TRUSTED_SESSION_SECONDS } from "./constants";
import { afterAuthHook, beforeAuthHook } from "./hooks";
import { capUntrustedExpiry, isTrustedSessionRequest, sessionExpiresAt } from "./session-policy";

const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");

// login cukup email + password (keputusan 0010); plugin passkey dan twoFactor tidak dipasang
export const auth = betterAuth({
  appName: "Kas Kita",
  baseURL: appUrl.origin,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: [appUrl.origin],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, account: authAccounts, verification: verifications },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  user: {
    // kolom tambahan tabel users; hanya diisi CLI dan mutations, tidak lewat endpoint Better Auth
    additionalFields: {
      displayName: { type: "string", required: true, input: false },
      identityColor: { type: "string", required: false, input: false },
      paydayDay: { type: "number", required: false, input: false },
      periodMode: { type: "string", required: false, input: false },
      onboardedAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: TRUSTED_SESSION_SECONDS,
    updateAge: 24 * 60 * 60,
    additionalFields: {
      trusted: { type: "boolean", required: false, input: false },
    },
  },
  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    database: { generateId: () => uuidv7() },
  },
  // akun dan pemulihan password hanya lewat CLI; profil diubah lewat mutations supaya tercatat di audit_log
  disabledPaths: [
    "/sign-up/email",
    "/update-user",
    "/delete-user",
    "/change-email",
    "/request-password-reset",
    "/reset-password",
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session, ctx) => {
          const trusted = typeof session.trusted === "boolean" ? session.trusted : isTrustedSessionRequest(ctx);
          return { data: { ...session, trusted, expiresAt: sessionExpiresAt(trusted) } };
        },
      },
      update: {
        before: async (data, ctx) => {
          const current = ctx?.context.session?.session;
          if (!current || !(data.expiresAt instanceof Date) || current.trusted === true) return;
          return { data: { ...data, expiresAt: capUntrustedExpiry(new Date(current.createdAt), data.expiresAt) } };
        },
      },
    },
  },
  hooks: { before: beforeAuthHook, after: afterAuthHook },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
