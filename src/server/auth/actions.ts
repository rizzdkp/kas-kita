"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "./auth";
import { LOGIN_PATH } from "./constants";
import { requireViewer, revokeSession } from "./session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const sessionIdSchema = z.uuid();
const SESSION_GONE = "Sesi ini sudah berakhir. Muat ulang halaman untuk melihat daftar terbaru.";

// AC4 F-AUTH-1: "Keluar dari perangkat ini" per sesi di Pengaturan
export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: SESSION_GONE };
  const revoked = await revokeSession(viewer, parsed.data);
  if (!revoked) return { ok: false, error: SESSION_GONE };
  if (parsed.data === viewer.sessionId) redirect(LOGIN_PATH);
  revalidatePath("/pengaturan");
  return { ok: true };
}

export async function signOutAction(): Promise<never> {
  await auth.api.signOut({ headers: await headers() });
  redirect(LOGIN_PATH);
}
