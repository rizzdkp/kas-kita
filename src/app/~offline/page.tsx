import type { Metadata } from "next";
import { OfflineActions } from "./offline-actions";

export const metadata: Metadata = { title: "Offline" };

// disajikan service worker untuk halaman yang belum punya salinan di perangkat; tanpa data dan tanpa sesi
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-canvas px-4 py-12">
      <div className="mx-auto flex w-full max-w-[44ch] flex-col gap-3">
        <h1 className="text-title text-primary">Kamu sedang offline</h1>
        <p className="text-body text-secondary">
          Halaman ini belum pernah dibuka di perangkat ini, jadi belum ada salinannya. Halaman yang sudah pernah dibuka, seperti
          Ringkasan, tetap tampil dengan data terakhir.
        </p>
        <p className="text-body text-secondary">
          Transaksi yang kamu ketik di bar bawah disimpan di perangkat dan dikirim otomatis saat koneksi kembali.
        </p>
        <OfflineActions />
      </div>
    </main>
  );
}
