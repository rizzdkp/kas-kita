"use client";

import { useCallback, useRef, useState } from "react";
import type { Scope } from "@/lib/scope";
import { parseQuickAdd } from "@/lib/quick-add-parser";
import { focusQuickAdd } from "@/components/glass/quick-add-bar";
import type { ToastOptions } from "@/components/ui/toast";
import { createQuickAddAction, undoQuickAddAction } from "@/server/actions/quick-add";
import { needsAi, resolveWithAi } from "./ai-resolver";
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
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRaw = useRef("");
  useOfflineFlush(showToast);

  const close = useCallback((restoreText: boolean) => {
    setItems(null);
    setError(null);
    if (restoreText) setText(lastRaw.current);
    focusQuickAdd();
  }, []);

  const submit = useCallback(
    async (raw: string, scope: Scope) => {
      const at = new Date();
      const parserCtx = buildParserContext(ctx, scope, at);
      let drafts = parseQuickAdd(raw, parserCtx);
      if (drafts.length === 0) return;
      if (needsAi(drafts)) {
        setBusy(true);
        try {
          drafts = (await resolveWithAi(drafts, parserCtx)) ?? drafts;
        } finally {
          setBusy(false);
        }
      }
      lastRaw.current = raw;
      setNow(at);
      setError(null);
      setItems(drafts.map((d) => draftToItem(d, newClientId())));
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
    saving,
    error,
    submit,
    change,
    remove,
    save,
    cancel: () => close(true),
  };
}
