"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { deleteAttachmentAction, getTransactionExtrasAction, type TransactionReceiptExtras } from "@/server/actions/receipts";
import { compressReceiptImage } from "./compress-image";
import { PhotoViewer } from "./photo-viewer";
import { attachmentUrl, uploadImage } from "./upload-image";

/** Lampiran foto dan rincian kategori di detail transaksi (F-IN-1 lampiran, F-IN-3 AC4). */
export function TransactionAttachments({ transactionId, editable = true }: { transactionId: string; editable?: boolean }) {
  const [extras, setExtras] = useState<TransactionReceiptExtras | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const result = await getTransactionExtrasAction(transactionId).catch(() => null);
    if (result?.ok) setExtras(result.data);
  }, [transactionId]);

  useEffect(() => {
    setExtras(null);
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setError(null);
    setProgress(0);
    const blob = await compressReceiptImage(file);
    const result = await uploadImage(blob, { transactionId, onProgress: setProgress });
    setProgress(null);
    if (!result.ok) setError(result.error);
    else await load();
  };

  const opened = extras?.attachments.find((a) => a.id === open) ?? null;
  const remove = async () => {
    if (!opened) return;
    setRemoving(true);
    const result = await deleteAttachmentAction({ id: opened.id, version: opened.version }).catch(() => null);
    setRemoving(false);
    if (!result?.ok) {
      setError(result?.error ?? "Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
      return;
    }
    setOpen(null);
    await load();
  };

  if (!extras) return null;
  return (
    <div className="flex flex-col gap-4">
      {extras.splits.length > 0 ? (
        <section aria-labelledby={`rincian-${transactionId}`} className="flex flex-col gap-2">
          <h3 id={`rincian-${transactionId}`} className="text-small font-medium text-primary">
            Rincian per kategori
          </h3>
          <dl className="flex flex-col gap-1 text-small">
            {extras.splits.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 text-secondary">
                  {s.categoryName}
                  {s.note ? <span className="block truncate text-caption text-tertiary">{s.note}</span> : null}
                </dt>
                <dd className="tabular-nums text-primary">{formatRupiah(s.amount)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby={`lampiran-${transactionId}`} className="flex flex-col gap-2">
        <h3 id={`lampiran-${transactionId}`} className="text-small font-medium text-primary">
          Lampiran
        </h3>
        {extras.attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {extras.attachments.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setOpen(a.id)}
                  aria-label={`Buka lampiran ${i + 1}`}
                  className="block overflow-hidden rounded-md border border-border bg-surface-sunken"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachmentUrl(a.id)} alt={`Lampiran ${i + 1}`} className="size-20 object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-secondary">Belum ada lampiran.</p>
        )}
        {editable ? (
          <div className="flex flex-col items-start gap-1">
            <Button variant="ghost" icon={Paperclip} loading={progress !== null} onClick={() => inputRef.current?.click()}>
              {progress !== null ? `Mengunggah ${Math.round(progress * 100)}%` : "Tambah lampiran"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        ) : null}
      </section>

      <PhotoViewer
        src={opened ? attachmentUrl(opened.id) : null}
        open={opened !== null}
        onOpenChange={(v) => !v && setOpen(null)}
        title="Lampiran"
        footer={
          editable ? (
            <Button variant="danger" onClick={() => void remove()} loading={removing}>
              Hapus lampiran
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
