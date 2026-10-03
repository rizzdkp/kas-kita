import type { Scope } from "@/lib/scope";
import type { Viewer } from "@/server/auth/viewer";

// kolom insights.scope: "me:<user id>" untuk cakupan pribadi (Partner = me milik user lain) dan "all" untuk Gabungan
export const ALL_SCOPE_KEY = "all";

export function personalScopeKey(userId: string): string {
  return `me:${userId}`;
}

/** Kunci baris wawasan yang dibaca viewer untuk cakupan tertentu; null kalau partner belum ada. */
export function insightScopeKey(viewer: Viewer, scope: Scope): string | null {
  if (scope === "all") return ALL_SCOPE_KEY;
  if (scope === "partner") return viewer.partner ? personalScopeKey(viewer.partner.id) : null;
  return personalScopeKey(viewer.user.id);
}
