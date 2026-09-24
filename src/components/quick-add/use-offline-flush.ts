"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ToastOptions } from "@/components/ui/toast";
import { createQuickAddAction } from "@/server/actions/quick-add";
import { listQueuedQuickAdds, offlineQueueAvailable, removeQueuedQuickAdds } from "./offline-queue";

/** Kirim antrean offline saat app dibuka dan saat koneksi kembali. */
export function useOfflineFlush(showToast: (options: ToastOptions) => void): () => Promise<void> {
  const running = useRef(false);

  const flush = useCallback(async () => {
    if (running.current || !offlineQueueAvailable() || !navigator.onLine) return;
    running.current = true;
    try {
      const queued = await listQueuedQuickAdds();
      if (queued.length === 0) return;
      const result = await createQuickAddAction(queued.map((q) => q.input));
      if (result.ok) {
        await removeQueuedQuickAdds(queued.map((q) => q.clientId));
        showToast({ title: queued.length > 1 ? `${queued.length} transaksi dari antrean tersimpan` : "Transaksi dari antrean tersimpan" });
      } else {
        showToast({ title: "Antrean belum terkirim", description: result.error, duration: 8000 });
      }
    } catch {
      // jaringan masih putus; coba lagi di event online berikutnya
    } finally {
      running.current = false;
    }
  }, [showToast]);

  useEffect(() => {
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  return flush;
}
