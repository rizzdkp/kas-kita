"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function OfflineActions() {
  // koneksi kembali: muat ulang halaman yang tadi diminta, bukan halaman offline ini
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);

  return (
    <div className="flex flex-wrap gap-3 pt-3">
      <Button variant="primary" onClick={() => window.location.reload()}>
        Coba lagi
      </Button>
      {/* navigasi dokumen penuh, bukan navigasi klien: salinan Ringkasan disajikan service worker sebagai dokumen */}
      <Button variant="secondary" onClick={() => window.location.assign("/")}>
        Buka Ringkasan
      </Button>
    </div>
  );
}
