import type { Scope } from "@/lib/scope";
import type { QuickAddDraft } from "@/lib/quick-add-parser";
import { resolveQuickAddWithAi } from "@/server/actions/quick-add-ai";
import { AI_UNAVAILABLE_MESSAGE, type AiLineFields } from "./ai-merge";

export const AI_TIMEOUT_MS = 30_000;

export type AiOutcome =
  | { status: "ok"; data: Array<AiLineFields | null> }
  | { status: "error"; message: string }
  | { status: "cancelled" };

export function needsAi(drafts: QuickAddDraft[]): boolean {
  return drafts.some((d) => d.missing.length > 0);
}

/** Indeks baris yang perlu AI; baris yang sudah lengkap tidak dikirim ke model (AC1). */
export function incompleteIndexes(drafts: QuickAddDraft[]): number[] {
  return drafts.flatMap((d, i) => (d.missing.length > 0 ? [i] : []));
}

/**
 * Panggil server action dengan batas 30 detik (UX-FLOWS 4) dan bisa dibatalkan.
 * Server action tidak bisa di-abort; hasil yang datang setelah batal atau timeout diabaikan.
 */
export function requestAi(lines: string[], scope: Scope, timeoutMs = AI_TIMEOUT_MS): { promise: Promise<AiOutcome>; cancel: () => void } {
  let settle: (outcome: AiOutcome) => void = () => {};
  const promise = new Promise<AiOutcome>((resolve) => {
    settle = resolve;
  });
  let done = false;
  const finish = (outcome: AiOutcome) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    settle(outcome);
  };
  const timer = setTimeout(() => finish({ status: "error", message: AI_UNAVAILABLE_MESSAGE }), timeoutMs);
  resolveQuickAddWithAi(lines, scope).then(
    (result) => finish(result.ok ? { status: "ok", data: result.data } : { status: "error", message: result.error || AI_UNAVAILABLE_MESSAGE }),
    () => finish({ status: "error", message: AI_UNAVAILABLE_MESSAGE }),
  );
  return { promise, cancel: () => finish({ status: "cancelled" }) };
}
