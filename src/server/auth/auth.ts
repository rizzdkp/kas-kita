import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { uuidv7 } from "@/lib/uuid";
import { db } from "@/server/db/client";
import { authAccounts, passkeys, sessions, twoFactors, users, verifications } from "@/server/db/schema";
import { AUTH_COOKIE_PREFIX, MIN_PASSWORD_LENGTH, TRUSTED_SESSION_SECONDS } from "./constants";
import { consumeEnrollmentToken, findEnrollmentUser } from "./enrollment";
import { afterAuthHook, beforeAuthHook } from "./hooks";
import { capUntrustedExpiry, isRememberRequested, sessionExpiresAt } from "./session-policy";

const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");

export const ENROLLMENT_INVALID_MESSAGE = "Tautan pendaftaran sudah dipakai atau kedaluwarsa. Minta tautan baru lewat perintah user:create --link.";

export const auth = betterAuth({
  appName: "Kas Kita",
  baseURL: appUrl.origin,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: [appUrl.origin],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: authAccounts,
      verification: verifications,
      passkey: passkeys,
      twoFactor: twoFactors,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
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
  // akun hanya lewat CLI; profil diubah lewat mutations supaya tercatat di audit_log
  disabledPaths: [
    "/sign-up/email",
    "/update-user",
    "/delete-user",
    "/change-email",
    "/request-password-reset",
    "/reset-password",
    "/two-factor/send-otp",
    "/two-factor/verify-otp",
    "/two-factor/verify-backup-code",
    "/two-factor/generate-backup-codes",
    "/two-factor/view-backup-codes",
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session, ctx) => {
          // sesi yang dibuat ulang plugin (mis. setelah TOTP aktif) mewarisi status tepercaya sesi lama
          const trusted =
            typeof session.trusted === "boolean" ? session.trusted : isRememberRequested(ctx?.headers?.get("cookie"));
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
  plugins: [
    passkey({
      rpID: appUrl.hostname,
      rpName: "Kas Kita",
      origin: appUrl.origin,
      registration: {
        requireSession: false,
        resolveUser: async ({ context }) => {
          const user = context ? await findEnrollmentUser(context) : null;
          if (!user) throw new APIError("BAD_REQUEST", { message: ENROLLMENT_INVALID_MESSAGE, code: "ENROLLMENT_INVALID" });
          return { id: user.id, name: user.email, displayName: user.displayName };
        },
        afterVerification: async ({ ctx, user, context }) => {
          // pendaftaran dari halaman Pengaturan memakai sesi; dari tautan CLI, token dipakai habis di sini
          if (!context) return;
          const userId = await consumeEnrollmentToken(context);
          if (!userId || userId !== user.id) {
            throw new APIError("BAD_REQUEST", { message: ENROLLMENT_INVALID_MESSAGE, code: "ENROLLMENT_INVALID" });
          }
          ctx.context.logger.info("Passkey terdaftar lewat tautan pendaftaran");
          return { userId };
        },
      },
    }),
    twoFactor({ issuer: "Kas Kita" }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
