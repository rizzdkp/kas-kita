import { boolean, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./common";

export const IDENTITY_COLORS = ["violet", "rose", "gold", "ocean", "plum", "slate"] as const;
export type IdentityColor = (typeof IDENTITY_COLORS)[number];

// tabel ini sekaligus tabel user Better Auth (name, email_verified, image, two_factor_enabled)
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  identityColor: text("identity_color").$type<IdentityColor>().notNull().default("violet"),
  paydayDay: smallint("payday_day").notNull().default(25),
  periodMode: text("period_mode").$type<"calendar" | "payday_cycle">().notNull().default("calendar"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  trusted: boolean("trusted").notNull().default(false),
  ...timestamps,
});

// "account" versi Better Auth (kredensial), bukan akun keuangan
export const authAccounts = pgTable("auth_accounts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verifications = pgTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});
