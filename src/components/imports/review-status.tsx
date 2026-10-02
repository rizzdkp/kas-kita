"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

// batch "parsing" diisi worker (PDF lewat AI bisa beberapa menit), jadi halaman menanyakan ulang secara berkala
const POLL_MS = 2500;

export function importUploadHref(accountId: string | null): string {
  return accountId ? `/impor?akun=${accountId}` : "/impor";
}

export function batchTransactionsHref(batchId: string): string {
  return `/transaksi?batch=${batchId}&scope=all`;
}

export function ReviewParsing({ ai }: { ai: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [router]);
  return (
    <section aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <div className="flex max-w-[60ch] flex-col gap-2">
        <h2 className="text-section text-primary">Membaca mutasi…</h2>
        <p className="text-body text-secondary">
          {ai
            ? "Model AI membaca mutasi per halaman. Biasanya kurang dari dua menit. Halaman ini diperbarui sendiri."
            : "Baris mutasi sedang dibaca dan dicocokkan dengan transaksi yang sudah tercatat. Halaman ini diperbarui sendiri."}
        </p>
      </div>
      <div className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </section>
  );
}

export function ReviewFailed({ message, accountId }: { message: string | null; accountId: string }) {
  return (
    <EmptyState
      title="Mutasi ini gagal dibaca"
      action={
        <Link href={importUploadHref(accountId)} className={buttonClassName("primary")}>
          Unggah file lain
        </Link>
      }
    >
      <p role="alert">{message ?? "File tidak bisa dibaca. Cek formatnya lalu unggah lagi."}</p>
    </EmptyState>
  );
}

export function ReviewCommitted({ batchId }: { batchId: string }) {
  return (
    <EmptyState
      title="Impor ini sudah disimpan"
      action={
        <Link href={batchTransactionsHref(batchId)} className={buttonClassName("primary")}>
          Lihat transaksi
        </Link>
      }
    >
      Transaksinya ada di daftar transaksi dengan filter impor ini.
    </EmptyState>
  );
}

export function ReviewNotFound() {
  return (
    <EmptyState
      title="Impor ini tidak ditemukan"
      action={
        <Link href="/impor" className={buttonClassName("primary")}>
          Impor mutasi
        </Link>
      }
    >
      Impor ini mungkin sudah dibatalkan. Unggah file mutasi lagi untuk memulai.
    </EmptyState>
  );
}

export function ReviewEmpty({ accountId }: { accountId: string }) {
  return (
    <EmptyState
      title="File ini tidak berisi transaksi"
      action={
        <Link href={importUploadHref(accountId)} className={buttonClassName("primary")}>
          Unggah file lain
        </Link>
      }
    >
      Tidak ada baris mutasi yang terbaca. Cek rentang tanggal di file, lalu unggah lagi.
    </EmptyState>
  );
}
