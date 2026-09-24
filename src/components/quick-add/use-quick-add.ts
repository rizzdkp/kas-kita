"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scope } from "@/lib/scope";
import { parseQuickAdd } from "@/lib/quick-add-parser";
import { focusQuickAdd } from "@/components/glass/quick-add-bar";
import type { ToastOptions } from "@/components/ui/toast";
import { createQuickAddAction, undoQuickAddAction } from "@/server/actions/quick-add";
import { applyAiResults } from "./ai-merge";
import { incompleteIndexes, requestAi } from "./ai-resolver";
import { enqueueQuickAdd, offlineQueueAvailable } from "./offline-queue";
import {
  accountById,
  applyEdit,
  attachError,
  buildParserContext,
  draftToItem,
  toCreateInput,
  type PreviewPatch,
  type QuickAddCreateInput,
} from "./preview-model";
import type { PreviewItem, QuickAddContextData } from "./types";
import { useOfflineFlush } from "./use-offline-flush";

const NETWORK_ERROR = "Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.";

function newClientId(): string {
  return crypto.randomUUID();
}

export function useQuickAdd(ctx: QuickAddContextData, showToast: (options: ToastOptions) => void) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  // jumlah baris yang sedang dibaca AI; lebih dari nol berarti bar dikunci
  const [aiLines, setAiLines] = useState(0);
  const busy = aiLines > 0;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const cancelAi = useRef<(() => void) | null>(null);
  const lastRaw = useRef("");
  useOfflineFlush(showToast);

  // input bar dikunci saat AI jalan, jadi Esc ditangkap di window
  useEffect(() => {
    if (!busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !cancelAi.current) return;
      event.preventDefault();
      cancelAi.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  const close = useCallback((restoreText: boolean) => {
    setItems(null);
    setError(null);
    setAiNotice(null);
    if (restoreText) setText(lastRaw.current);
    focusQuickAdd();
  }, []);

  const submit = useCallback(
    async (raw: string, scope: Scope) => {
      const at = new Date();
      const parserCtx = buildParserContext(ctx, scope, at);
      const drafts = parseQuickAdd(raw, parserCtx);
      if (drafts.length === 0) return;
      let next = drafts.map((d) => draftToItem(d, newClientId()));
      let notice: string | null = null;
      const indexes = incompleteIndexes(drafts);
      // offline: AI dilewati, kartu tampil dengan field kosong ditandai (AC5)
      if (indexes.length > 0 && ctx.aiAvailable && navigator.onLine) {
        const run = requestAi(indexes.map((i) => drafts[i]!.raw), scope);
        cancelAi.current = run.cancel;
        setAiLines(indexes.length);
        try {
          const outcome = await run.promise;
          if (outcome.status === "ok") next = applyAiResults(next, drafts, indexes, outcome.data, ctx, parserCtx);
          else if (outcome.status === "error") notice = outcome.message;
        } finally {
          cancelAi.current = null;
          setAiLines(0);
        }
      }
      lastRaw.current = raw;
      setNow(at);
      setError(null);
      setAiNotice(notice);
      setItems(next);
      setText("");
    },
    [ctx],
  );

  const change = useCallback(
    (clientId: string, patch: PreviewPatch) => {
      setError(null);
      setItems((list) => list?.map((i) => (i.clientId === clientId ? applyEdit(i, patch, ctx) : i)) ?? null);
    },
    [ctx],
  );

  const remove = useCallback((clientId: string) => {
    setItems((list) => {
      const next = list?.filter((i) => i.clientId !== clientId) ?? null;
      return next && next.length > 0 ? next : null;
    });
  }, []);

  const undo = useCallback(
    async (refs: Array<{ id: string; version: number }>) => {
      try {
        const result = await undoQuickAddAction(refs);
        showToast(result.ok ? { title: "Diurungkan" } : { title: "Belum bisa diurungkan", description: result.error });
      } catch {
        showToast({ title: "Belum bisa diurungkan", description: NETWORK_ERROR });
      }
    },
    [showToast],
  );

  const queueOffline = useCallback(
    async (inputs: QuickAddCreateInput[]) => {
      await enqueueQuickAdd(inputs);
      close(false);
      showToast({ title: "Tersimpan di perangkat", description: "Dikirim otomatis saat koneksi kembali." });
    },
    [close, showToast],
  );

  const save = useCallback(async () => {
    if (!items || saving) return;
    const inputs = items.map((i) => toCreateInput(i, ctx));
    if (inputs.some((i) => i === null)) return;
    const list = inputs as QuickAddCreateInput[];
    setSaving(true);
    setError(null);
    try {
      if (!navigator.onLine && offlineQueueAvailable()) {
        await queueOffline(list);
        return;
      }
      const result = await createQuickAddAction(list);
      if (!result.ok) {
        const marked = attachError(items, result.error, result.accountId ?? null);
        const hit = marked.some((i) => i.error);
        setItems(marked);
        setError(hit ? null : result.error);
        return;
      }
      const partnerNames = new Set(
        list.flatMap((i) => [accountById(ctx, i.accountId), accountById(ctx, i.toAccountId)]).flatMap((a) =>
          a?.owner === "partner" && a.ownerName ? [a.ownerName] : [],
        ),
      );
      const [partner] = [...partnerNames];
      close(false);
      showToast({
        title: partner ? `Tersimpan. ${partner} akan melihat perubahan ini di riwayat.` : "Tersimpan",
        action: { label: "Urungkan", onAction: () => void undo(result.data.map(({ id, version }) => ({ id, version }))) },
        duration: 5000,
      });
    } catch {
      if (offlineQueueAvailable() && !navigator.onLine) await queueOffline(list);
      else setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }, [items, saving, ctx, close, showToast, undo, queueOffline]);

  return {
    text,
    setText,
    items,
    now,
    busy,
    aiLines,
    saving,
    error,
    aiNotice,
    submit,
    cancelAi: () => cancelAi.current?.(),
    change,
    remove,
    save,
    cancel: () => close(true),
    dismiss: () => close(false),
  };
}
