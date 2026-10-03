"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { WifiOff } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { CACHE_PAGE_MESSAGE, CLEAR_PAGES_MESSAGE, isCacheablePagePath } from "@/lib/pwa";

const LOGIN_PATH = "/login";
// navigasi beruntun (ganti cakupan, ketik filter) cukup disimpan sekali
const CACHE_DEBOUNCE_MS = 1500;

function post(message: { type: string; url?: string }): void {
  navigator.serviceWorker?.controller?.postMessage(message);
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Jembatan ke service worker: meminta halaman yang dibuka lewat navigasi klien disimpan sebagai
 * data terakhir, menghapusnya di halaman login, dan memberi tahu saat yang tampil adalah salinan offline.
 */
export function PwaClient() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const online = useOnline();
  const first = useRef(true);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (pathname.startsWith(LOGIN_PATH)) {
      // keluar atau sesi berakhir: salinan halaman milik sesi sebelumnya dihapus dari perangkat
      void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: CLEAR_PAGES_MESSAGE }));
      return;
    }
    if (!isCacheablePagePath(pathname)) return;
    const href = window.location.href;
    const isFirst = first.current;
    first.current = false;
    // muat pertama yang sudah lewat service worker sudah tersimpan oleh strategi NetworkFirst
    if (isFirst && navigator.serviceWorker.controller) return;
    if (isFirst) {
      const onControl = () => {
        if (navigator.onLine) post({ type: CACHE_PAGE_MESSAGE, url: href });
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControl, { once: true });
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControl);
    }
    const timer = window.setTimeout(() => {
      if (navigator.onLine) post({ type: CACHE_PAGE_MESSAGE, url: window.location.href });
    }, CACHE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  if (online || !isCacheablePagePath(pathname)) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(68px+env(safe-area-inset-top))] z-30 flex justify-center px-4 sm:top-21"
    >
      <p className="inline-flex max-w-full items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-small text-secondary shadow-glass">
        <Icon icon={WifiOff} size={16} className="shrink-0" />
        Offline. Yang tampil adalah data terakhir di perangkat ini.
      </p>
    </div>
  );
}
