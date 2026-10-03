"use server";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import type { ActionResult } from "@/server/actions/result";
import { auth } from "./auth";
import { passwordSchema } from "./create-user";
import { requireViewer } from "./session";

const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, { error: "Isi password sekarang." }),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { error: "Kedua password belum sama.", path: ["confirmPassword"] });

export type ChangePasswordInput = z.input<typeof changePasswordInput>;

function fieldError(field: string, message: string, code = "validation"): ActionResult {
  return { ok: false, code, error: message, fieldErrors: { [field]: [message] } };
}

// semua sesi lain dicabut supaya password lama yang mungkin bocor tidak menyisakan perangkat yang masih masuk
export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  await requireViewer();
  const parsed = changePasswordInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fieldError(String(issue?.path[0] ?? "newPassword"), issue?.message ?? "Password minimal 12 karakter.");
  }
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return fieldError("newPassword", "Password baru harus berbeda dari password sekarang.");
  }
  try {
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
    return { ok: true, data: undefined };
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
      return fieldError("currentPassword", "Password sekarang salah.", "invalid_password");
    }
    if (isAPIError(error)) return { ok: false, code: "auth", error: "Password gagal diganti. Muat ulang halaman lalu coba lagi." };
    throw error;
  }
}
