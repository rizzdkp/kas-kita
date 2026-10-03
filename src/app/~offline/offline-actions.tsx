"use client";

import { useEffect } from "react";
import { Button, buttonClassName } from "@/components/ui/button";

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
      {/* tautan biasa, bukan next/link: navigasi dokumen penuh supaya salinan Ringkasan dari service worker yang dipakai */}
      <a href="/" className={buttonClassName("secondary")}>
        Buka Ringkasan
      </a>
    </div>
  );
}
