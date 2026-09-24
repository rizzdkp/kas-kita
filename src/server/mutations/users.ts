import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { UserRow, Viewer } from "@/server/auth/viewer";
import { db as defaultDb, type DbOrTx, type Tx } from "@/server/db/client";
import { IDENTITY_COLORS, users } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { IDENTITY_COLOR_NAMES } from "@/components/settings/identity-color-names";
import { computeDiff, writeAudit } from "./audit";
import { inTransaction, parseInput, pickProvided } from "./_shared";

export const PAYDAY_MESSAGE = "Isi tanggal gajian 1 sampai 31";

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Isi nama tampilan").max(40, "Nama tampilan maksimal 40 karakter"),
  identityColor: z.enum(IDENTITY_COLORS, "Pilih salah satu warna identitas"),
  paydayDay: z.number(PAYDAY_MESSAGE).int(PAYDAY_MESSAGE).min(1, PAYDAY_MESSAGE).max(31, PAYDAY_MESSAGE),
  periodMode: z.enum(["calendar", "payday_cycle"], "Pilih awal periode"),
});
export type UpdateProfileInput = Partial<z.input<typeof profileSchema>>;

function colorTakenMessage(partnerName: string, color: (typeof IDENTITY_COLORS)[number]): string {
  return `Warna ${IDENTITY_COLOR_NAMES[color]} sudah dipakai ${partnerName}. Pilih warna lain.`;
}

// unique index users_identity_color_unique tetap jadi penjaga terakhir kalau dua orang menyimpan bersamaan
function isColorUniqueViolation(e: unknown): boolean {
  for (let cur: unknown = e; cur && typeof cur === "object"; cur = (cur as { cause?: unknown }).cause) {
    const err = cur as { code?: unknown; constraint_name?: unknown };
    if (err.code === "23505" && err.constraint_name === "users_identity_color_unique") return true;
  }
  return false;
}

async function lockUser(tx: Tx, id: string): Promise<UserRow> {
  const [row] = await tx.select().from(users).where(eq(users.id, id)).for("update");
  if (!row) throw new NotFoundError("users", id);
  return row;
}

async function applyUserUpdate(tx: Tx, actor: UserRow, values: Partial<typeof users.$inferInsert>): Promise<UserRow> {
  const [after] = await tx
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, actor.id))
    .returning();
  if (!after) throw new NotFoundError("users", actor.id);
  const diff = computeDiff(users, actor, after);
  if (Object.keys(diff).length > 0) {
    await writeAudit(tx, { actorId: actor.id, entity: "users", entityId: actor.id, action: "update", diff });
  }
  return after;
}

/** Ubah profil sendiri (F-SET-1); warna identitas partner ditolak dengan pesan yang menyebut namanya. */
export async function updateProfile(viewer: Viewer, input: UpdateProfileInput, db: DbOrTx = defaultDb): Promise<UserRow> {
  const parsed = parseInput(profileSchema.partial(), input);
  const patch = pickProvided(parsed, input);
  try {
    return await inTransaction(db, async (tx) => {
      const current = await lockUser(tx, viewer.user.id);
      if (patch.identityColor && patch.identityColor !== current.identityColor) {
        const [owner] = await tx
          .select({ displayName: users.displayName })
          .from(users)
          .where(and(eq(users.identityColor, patch.identityColor), ne(users.id, current.id)));
        if (owner) {
          const message = colorTakenMessage(owner.displayName, patch.identityColor);
          throw new ValidationError(message, { identityColor: [message] });
        }
      }
      if (Object.keys(patch).length === 0) return current;
      return applyUserUpdate(tx, current, patch);
    });
  } catch (e) {
    if (!isColorUniqueViolation(e) || !patch.identityColor) throw e;
    const message = colorTakenMessage(viewer.partner?.displayName ?? "partner", patch.identityColor);
    throw new ValidationError(message, { identityColor: [message] });
  }
}

/** Tandai pengenalan selesai atau dilewati supaya pengalihan ke /mulai berhenti. */
export async function markOnboarded(viewer: Viewer, db: DbOrTx = defaultDb, now: Date = new Date()): Promise<UserRow> {
  return inTransaction(db, async (tx) => {
    const current = await lockUser(tx, viewer.user.id);
    return applyUserUpdate(tx, current, { onboardedAt: now });
  });
}
