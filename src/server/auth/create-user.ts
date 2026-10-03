import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db, type DbOrTx } from "@/server/db/client";
import { authAccounts, IDENTITY_COLORS, sessions, users, type IdentityColor } from "@/server/db/schema";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./constants";
import type { UserRow } from "./viewer";

export class CreateUserError extends Error {}

const CREDENTIAL_PROVIDER = "credential";

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` })
  .max(MAX_PASSWORD_LENGTH, { error: `Password maksimal ${MAX_PASSWORD_LENGTH} karakter.` });

const emailSchema = z.email({ error: "Email tidak valid." }).transform((v) => v.trim().toLowerCase());

export const createUserInputSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, { error: "Nama tidak boleh kosong." }).max(40, { error: "Nama maksimal 40 karakter." }),
  color: z.enum(IDENTITY_COLORS, { error: `Warna harus salah satu dari: ${IDENTITY_COLORS.join(", ")}.` }).optional(),
  payday: z.coerce.number().int().min(1, { error: "Tanggal gajian 1 sampai 31." }).max(31, { error: "Tanggal gajian 1 sampai 31." }).optional(),
  password: passwordSchema,
});
export type CreateUserInput = z.input<typeof createUserInputSchema>;

function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object" && "code" in current && typeof current.code === "string") return current.code;
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

function parsePassword(password: string): string {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new CreateUserError(parsed.error.issues[0]?.message ?? `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  return parsed.data;
}

async function pickColor(requested: IdentityColor | undefined, dbx: DbOrTx): Promise<IdentityColor> {
  const taken = new Set((await dbx.select({ color: users.identityColor }).from(users)).map((r) => r.color));
  if (requested) {
    if (taken.has(requested)) {
      const free = IDENTITY_COLORS.filter((c) => !taken.has(c));
      throw new CreateUserError(`Warna ${requested} sudah dipakai pengguna lain. Pilih salah satu: ${free.join(", ")}.`);
    }
    return requested;
  }
  const free = IDENTITY_COLORS.find((c) => !taken.has(c));
  if (!free) throw new CreateUserError("Semua warna identitas sudah dipakai.");
  return free;
}

// hash memakai fungsi bawaan Better Auth (scrypt) supaya /sign-in/email bisa memverifikasinya
async function upsertCredential(userId: string, password: string, dbx: DbOrTx): Promise<void> {
  const hash = await hashPassword(password);
  const updated = await dbx
    .update(authAccounts)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, CREDENTIAL_PROVIDER)))
    .returning({ id: authAccounts.id });
  if (updated.length === 0) {
    await dbx.insert(authAccounts).values({ userId, accountId: userId, providerId: CREDENTIAL_PROVIDER, password: hash });
  }
}

export async function createUser(input: CreateUserInput, dbx: DbOrTx = db): Promise<UserRow> {
  const parsed = createUserInputSchema.safeParse(input);
  if (!parsed.success) throw new CreateUserError(parsed.error.issues.map((i) => i.message).join(" "));
  const { email, name, color, payday, password } = parsed.data;
  const identityColor = await pickColor(color, dbx);
  try {
    return await dbx.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name, displayName: name, emailVerified: true, identityColor, paydayDay: payday ?? 25 })
        .returning();
      if (!user) throw new CreateUserError("Pengguna gagal dibuat.");
      await upsertCredential(user.id, password, tx);
      return user;
    });
  } catch (error) {
    const code = pgErrorCode(error);
    // 23514 dari trigger users_max_two, 23505 dari email atau warna yang sudah ada
    if (code === "23514") throw new CreateUserError("Kas Kita sudah punya dua pengguna. Pengguna ketiga tidak bisa dibuat.");
    if (code === "23505") {
      const [existing] = await dbx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) throw new CreateUserError(`Email ${email} sudah terdaftar. Pakai --reset-password untuk mengganti passwordnya.`);
      throw new CreateUserError(`Warna ${identityColor} sudah dipakai pengguna lain.`);
    }
    throw error;
  }
}

export interface SetPasswordOptions {
  /** Pemulihan lewat CLI mengeluarkan semua perangkat; skrip dev tidak, supaya sesi lain tetap jalan. */
  revokeSessions: boolean;
}

export async function setUserPassword(email: string, password: string, options: SetPasswordOptions, dbx: DbOrTx = db): Promise<UserRow> {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) throw new CreateUserError("Email tidak valid.");
  const valid = parsePassword(password);
  const [user] = await dbx.select().from(users).where(eq(users.email, parsedEmail.data)).limit(1);
  if (!user) throw new CreateUserError(`Belum ada pengguna dengan email ${parsedEmail.data}.`);
  await dbx.transaction(async (tx) => {
    await upsertCredential(user.id, valid, tx);
    if (options.revokeSessions) await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  return user;
}
