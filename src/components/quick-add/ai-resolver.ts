import type { QuickAddContext, QuickAddDraft } from "@/lib/quick-add-parser";

/**
 * Titik ekstensi F-IN-2 AC2 untuk M3: melengkapi draf yang field wajibnya kosong lewat model teks.
 * Mengembalikan null kalau AI belum terkonfigurasi; pemanggil lalu menampilkan draf apa adanya (AC5).
 */
export async function resolveWithAi(drafts: QuickAddDraft[], ctx: QuickAddContext): Promise<QuickAddDraft[] | null> {
  void drafts;
  void ctx;
  return null;
}

export function needsAi(drafts: QuickAddDraft[]): boolean {
  return drafts.some((d) => d.missing.length > 0);
}
