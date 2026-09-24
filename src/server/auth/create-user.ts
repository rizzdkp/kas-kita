import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "@/server/db/client";
import { IDENTITY_COLORS, users, type IdentityColor } from "@/server/db/schema";
import { createEnrollmentToken, enrollmentUrl } from "./enrollment";
import type { UserRow } from "./viewer";

export class CreateUserError extends Error {}

export const createUserInputSchema = z.object({
  email: z.email({ error: "Email tidak valid." }).transform((v) => v.trim().toLowerCase()),
  name: z.string().trim().min(1, { error: "Nama tidak boleh kosong." }).max(40, { error: "Nama maksimal 40 karakter." }),
  color: z.enum(IDENTITY_COLORS, { error: `Warna harus salah satu dari: ${IDENTITY_COLORS.join(", ")}.` }).optional(),
  payday: z.coerce.number().int().min(1, { error: "Tanggal gajian 1 sampai 31." }).max(31, { error: "Tanggal gajian 1 sampai 31." }).optional(),
});
export type CreateUserInput = z.input<typeof createUserInputSchema>;

export interface CreatedUser {
  user: UserRow;
  enrollmentUrl: string;
}

function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object" && "code" in current && typeof current.code === "string") return current.code;
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return undefined;
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

export async function createUser(input: CreateUserInput, now: Date = new Date(), dbx: DbOrTx = db): Promise<CreatedUser> {
  const parsed = createUserInputSchema.safeParse(input);
  if (!parsed.success) throw new CreateUserError(parsed.error.issues.map((i) => i.message).join(" "));
  const { email, name, color, payday } = parsed.data;
  const identityColor = await pickColor(color, dbx);
  let user: UserRow | undefined;
  try {
    [user] = await dbx
      .insert(users)
      .values({ email, name, displayName: name, emailVerified: true, identityColor, paydayDay: payday ?? 25 })
      .returning();
  } catch (error) {
    const code = pgErrorCode(error);
    // 23514 dari trigger users_max_two, 23505 dari email atau warna yang sudah ada
    if (code === "23514") throw new CreateUserError("Kas Kita sudah punya dua pengguna. Pengguna ketiga tidak bisa dibuat.");
    if (code === "23505") {
      const [existing] = await dbx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) throw new CreateUserError(`Email ${email} sudah terdaftar. Pakai --link untuk membuat tautan pendaftaran baru.`);
      throw new CreateUserError(`Warna ${identityColor} sudah dipakai pengguna lain.`);
    }
    throw error;
  }
  if (!user) throw new CreateUserError("Pengguna gagal dibuat.");
  const token = await createEnrollmentToken(user.id, now, dbx);
  return { user, enrollmentUrl: enrollmentUrl(token) };
}

export async function createEnrollmentLinkForEmail(email: string, now: Date = new Date(), dbx: DbOrTx = db): Promise<CreatedUser> {
  const [user] = await dbx.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user) throw new CreateUserError(`Belum ada pengguna dengan email ${email}.`);
  const token = await createEnrollmentToken(user.id, now, dbx);
  return { user, enrollmentUrl: enrollmentUrl(token) };
}
