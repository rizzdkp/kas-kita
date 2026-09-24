import { revalidatePath } from "next/cache";
import { ConflictError, DomainError, ValidationError } from "@/server/errors";

export type ActionError = {
  ok: false;
  error: string;
  code: string;
  fieldErrors?: Record<string, string[]>;
  // baris terbaru untuk dialog konflik F-HIST-3
  conflict?: { latest: unknown; updatedByName: string | null; updatedAt: Date };
};
export type ActionResult<T = void> = { ok: true; data: T } | ActionError;

const GENERIC_ERROR = "Terjadi kesalahan di server. Coba lagi sebentar lagi.";

export function toActionError(e: unknown): ActionError {
  if (e instanceof ConflictError) {
    return { ok: false, code: e.code, error: e.message, conflict: { latest: e.latest, updatedByName: e.updatedByName, updatedAt: e.updatedAt } };
  }
  if (e instanceof ValidationError) return { ok: false, code: e.code, error: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof DomainError) return { ok: false, code: e.code, error: e.message };
  // detail error tidak dikirim ke klien dan tidak memuat nominal (SECURITY.md)
  console.error(JSON.stringify({ level: "error", msg: "action_failed", name: e instanceof Error ? e.name : "unknown" }));
  return { ok: false, code: "internal", error: GENERIC_ERROR };
}

/** Bungkus server action: error domain jadi hasil yang bisa ditampilkan, lalu segarkan semua halaman app. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && typeof e.digest === "string" && e.digest.startsWith("NEXT_")) throw e;
    return toActionError(e);
  }
}
