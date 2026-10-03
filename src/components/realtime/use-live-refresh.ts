"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const EVENTS_PATH = "/api/events";
// ARCHITECTURE 8: beberapa simpan beruntun dari partner cukup memicu satu refresh
export const REFRESH_DEBOUNCE_MS = 1_000;
const RECONNECT_MIN_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

/** Dialog/Sheet terbuka atau kolom yang sedang diketik: refresh ditunda supaya isian tidak berubah di depan pengguna. */
export function isEditingNow(doc: Document = document): boolean {
  if (doc.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return true;
  const el = doc.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Berlangganan SSE perubahan data dan memanggil router.refresh() dengan debounce.
 * router.refresh() mempertahankan state komponen klien, jadi isian yang sedang diketik tidak hilang.
 */
export function useLiveRefresh(enabled = true): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let opened = false;
    let pending = false;
    let stopped = false;

    const flush = () => {
      debounce = null;
      if (document.visibilityState === "hidden") {
        pending = true;
        return;
      }
      if (isEditingNow()) {
        debounce = setTimeout(flush, REFRESH_DEBOUNCE_MS);
        return;
      }
      pending = false;
      router.refresh();
    };
    const schedule = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(flush, REFRESH_DEBOUNCE_MS);
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource(EVENTS_PATH);
      source.addEventListener("change", schedule);
      source.onopen = () => {
        // event selama terputus tidak dikirim ulang; satu refresh menyusulkan semuanya
        if (opened) schedule();
        opened = true;
        attempts = 0;
      };
      source.onerror = () => {
        // EventSource menyambung ulang sendiri kecuali server menolak (401) atau koneksi ditutup permanen
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        source = null;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempts);
        attempts += 1;
        reconnect = setTimeout(connect, delay);
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && pending) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    connect();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (debounce) clearTimeout(debounce);
      if (reconnect) clearTimeout(reconnect);
      source?.close();
    };
  }, [enabled, router]);
}
