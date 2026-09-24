"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { db } from "@/server/db/client";
import { authAccounts, twoFactors } from "@/server/db/schema";
import { auth } from "./auth";
import { MIN_PASSWORD_LENGTH } from "./constants";
import { getViewer } from "./session";

export type BackupSetupResult =
  | { ok: true; totpUri: string; secret: string }
  | { ok: false; error: string };

export type BackupConfirmResult = { ok: true } | { ok: false; error: string };

const NO_SESSION = "Daftarkan passkey dulu. Password dan TOTP cadangan disetel setelah passkey aktif.";

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` })
  .max(128, { error: "Password maksimal 128 karakter." });

const codeSchema = z.string().trim().regex(/^\d{6}$/, { error: "Kode terdiri dari 6 angka." });

// langkah 1: set password lalu minta secret TOTP; password belum bisa dipakai sampai TOTP dikonfirmasi
export async function startBackupSetup(password: string): Promise<BackupSetupResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NO_SESSION };
  if (viewer.user.twoFactorEnabled) return { ok: false, error: "Password dan TOTP cadangan sudah aktif untuk akun ini." };
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Password tidak valid." };

  // sisa penyetelan yang tidak selesai dibuang supaya bisa diulang dari awal
  await db.delete(twoFactors).where(eq(twoFactors.userId, viewer.user.id));
  await db.delete(authAccounts).where(and(eq(authAccounts.userId, viewer.user.id), eq(authAccounts.providerId, "credential")));

  const requestHeaders = await headers();
  try {
    await auth.api.setPassword({ body: { newPassword: parsed.data }, headers: requestHeaders });
    const enabled = await auth.api.enableTwoFactor({ body: { password: parsed.data, method: "totp" }, headers: requestHeaders });
    if (enabled.method !== "totp" || !("totpURI" in enabled) || !enabled.totpURI) {
      return { ok: false, error: "TOTP gagal disiapkan. Coba lagi." };
    }
    const secret = new URL(enabled.totpURI).searchParams.get("secret") ?? "";
    return { ok: true, totpUri: enabled.totpURI, secret };
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: "Password atau TOTP gagal disetel. Muat ulang halaman lalu coba lagi." };
    throw error;
  }
}

// langkah 2: kode pertama dari aplikasi autentikator mengaktifkan TOTP sekaligus password cadangan
export async function confirmBackupTotp(code: string): Promise<BackupConfirmResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NO_SESSION };
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Kode tidak valid." };
  try {
    await auth.api.verifyTOTP({ body: { code: parsed.data }, headers: await headers() });
    return { ok: true };
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: "Kode tidak cocok. Pastikan jam ponselmu tepat lalu masukkan kode terbaru." };
    throw error;
  }
}
