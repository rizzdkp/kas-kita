"use server";

import { z } from "zod";
import { parseScope } from "@/lib/scope";
import { requireViewer } from "@/server/auth/session";
import type { AiLineFields } from "@/components/quick-add/ai-merge";
import { resolveQuickAddLines } from "@/server/ai/quick-add/resolve";
import { parseInput } from "@/server/mutations/_shared";
import { toActionError } from "./result";

export type QuickAddAiActionResult = { ok: true; data: Array<AiLineFields | null> } | { ok: false; code: string; error: string };

const linesSchema = z.array(z.string().trim().min(1).max(500)).min(1).max(20);

/**
 * Lengkapi baris quick-add yang belum lengkap lewat model teks (F-IN-2 AC2).
 * Hanya membaca; tanpa runAction supaya halaman tidak dirender ulang.
 */
export async function resolveQuickAddWithAi(lines: string[], scope: string): Promise<QuickAddAiActionResult> {
  const viewer = await requireViewer();
  try {
    const list = parseInput(linesSchema, lines);
    return await resolveQuickAddLines(viewer, list, parseScope(scope));
  } catch (e) {
    const { code, error } = toActionError(e);
    return { ok: false, code, error };
  }
}
