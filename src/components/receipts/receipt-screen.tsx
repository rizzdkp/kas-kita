"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { ReceiptForm } from "./receipt-form";
import { ReceiptPhoto } from "./receipt-photo";
import { ReceiptPicker } from "./receipt-picker";
import { useReceiptFlow, type ReceiptPhase } from "./use-receipt-flow";

type ReceiptScreenProps = {
  options: TransactionFormOptions;
  scope: string | null;
  defaultAccountId: string;
  vision: boolean;
  initialAttachmentId: string | null;
  /** Lampiran di URL sudah tersimpan di transaksi ini (misalnya tombol kembali setelah simpan). */
  savedTransactionId: string | null;
};

function transactionHref(id: string, scope: string | null): string {
  return `/transaksi?id=${id}${scope === "partner" || scope === "all" ? `&scope=${scope}` : ""}`;
}

function ProgressCard({ phase }: { phase: Extract<ReceiptPhase, { name: "uploading" | "reading" }> }) {
  const uploading = phase.name === "uploading";
  const percent = uploading ? Math.round(phase.progress * 100) : 100;
  return (
    <Card className="flex flex-col gap-5" aria-busy>
      <div className="flex flex-col gap-2">
        <p role="status" className="text-card text-primary">
          {uploading ? `Mengunggah foto ${percent}%` : "Membaca struk…"}
        </p>
        <div
          role="progressbar"
          aria-label={uploading ? "Progres unggah" : "Membaca struk"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={uploading ? percent : undefined}
          className="h-1 overflow-hidden rounded-pill bg-surface-sunken"
        >
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-(--dur-base) ease-(--ease-out)"
            style={{ width: `${percent}%` }}
          />
        </div>
        {!uploading ? <p className="text-small text-secondary">Model AI membaca toko, tanggal, total, dan item. Biasanya kurang dari satu menit.</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}

/** Layar foto struk: pilih atau seret, unggah, baca, lalu pratinjau dua kolom (UX-FLOWS 5). */
export function ReceiptScreen({ options, scope, defaultAccountId, vision, initialAttachmentId, savedTransactionId }: ReceiptScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const { phase, photoUrl, start, reset } = useReceiptFlow({ scope, initialAttachmentId: savedTransactionId ? null : initialAttachmentId });

  if (savedTransactionId && phase.name === "pick" && !phase.error) {
    return (
      <div className="flex max-w-[56ch] flex-col items-start gap-3 py-8">
        <h2 className="text-section text-primary">Struk ini sudah tersimpan</h2>
        <p className="text-body text-secondary">Foto ini sudah jadi lampiran sebuah transaksi. Buka transaksinya untuk mengubah, atau baca struk lain.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={transactionHref(savedTransactionId, scope)} className={buttonClassName("primary")}>
            Lihat transaksi
          </Link>
          <Link href={scope === "partner" || scope === "all" ? `/struk?scope=${scope}` : "/struk"} className={buttonClassName("ghost")}>
            Foto struk lain
          </Link>
        </div>
      </div>
    );
  }

  if (phase.name === "pick") return <ReceiptPicker vision={vision} error={phase.error} onFile={(file) => void start(file)} />;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
      <ReceiptPhoto src={photoUrl} />
      {phase.name === "review" ? (
        <ReceiptForm
          key={phase.attachmentId}
          attachmentId={phase.attachmentId}
          draft={phase.draft}
          aiError={phase.aiError}
          options={options}
          defaultAccountId={defaultAccountId}
          onCancel={reset}
          onSaved={(id) => {
            toast.show({ title: "Tersimpan" });
            router.push(transactionHref(id, scope));
          }}
        />
      ) : (
        <ProgressCard phase={phase} />
      )}
    </div>
  );
}
