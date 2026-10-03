import type { Scope } from "@/lib/scope";

/** Tautan ke halaman lain dengan cakupan yang sama. */
export function scopedHref(path: string, scope: Scope): string {
  return scope === "me" ? path : `${path}?scope=${scope}`;
}
