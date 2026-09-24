"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readReceiptAction } from "@/server/actions/receipts";
import { compressReceiptImage } from "./compress-image";
import { subscribePendingReceiptFile, takePendingReceiptFile } from "./pending-file";
import { OFFLINE_RECEIPT_COPY, receiptHref } from "./receipt-copy";
import type { ReceiptDraftData } from "./receipt-form-model";
import { attachmentUrl, uploadImage } from "./upload-image";

export type ReceiptPhase =
  | { name: "pick"; error: string | null }
  | { name: "uploading"; progress: number }
  | { name: "reading"; attachmentId: string }
  | { name: "review"; attachmentId: string; draft: ReceiptDraftData; aiError: string | null };

const EMPTY_DRAFT: ReceiptDraftData = { merchant: null, date: null, time: null, total: null, items: [] };

/** Alur foto struk: pilih → kompres dan unggah (progres) → baca dengan AI → pratinjau. */
export function useReceiptFlow(opts: { scope: string | null; initialAttachmentId: string | null }) {
  const { scope, initialAttachmentId } = opts;
  const [phase, setPhase] = useState<ReceiptPhase>(() =>
    initialAttachmentId ? { name: "reading", attachmentId: initialAttachmentId } : { name: "pick", error: null },
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialAttachmentId ? attachmentUrl(initialAttachmentId) : null);
  const objectUrl = useRef<string | null>(null);
  const run = useRef(0);

  const setLocalPhoto = useCallback((url: string | null) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = url?.startsWith("blob:") ? url : null;
    setPhotoUrl(url);
  }, []);

  const read = useCallback(async (attachmentId: string, token: number) => {
    setPhase({ name: "reading", attachmentId });
    const result = await readReceiptAction(attachmentId).catch(() => null);
    if (token !== run.current) return;
    if (!result) {
      setPhase({ name: "review", attachmentId, draft: EMPTY_DRAFT, aiError: "Tidak bisa terhubung ke server. Isi field dari foto sendiri." });
    } else if (!result.ok) {
      setPhase({ name: "review", attachmentId, draft: EMPTY_DRAFT, aiError: result.error });
    } else {
      setPhase({ name: "review", attachmentId, draft: result.data.draft, aiError: result.data.aiError?.message ?? null });
    }
  }, []);

  const start = useCallback(
    async (file: File) => {
      const token = ++run.current;
      if (!navigator.onLine) {
        setPhase({ name: "pick", error: OFFLINE_RECEIPT_COPY.body });
        return;
      }
      setLocalPhoto(URL.createObjectURL(file));
      setPhase({ name: "uploading", progress: 0 });
      const blob = await compressReceiptImage(file);
      if (token !== run.current) return;
      const uploaded = await uploadImage(blob, {
        onProgress: (progress) => token === run.current && setPhase({ name: "uploading", progress }),
      });
      if (token !== run.current) return;
      if (!uploaded.ok) {
        setLocalPhoto(null);
        setPhase({ name: "pick", error: uploaded.error });
        return;
      }
      setLocalPhoto(attachmentUrl(uploaded.id));
      // muat ulang halaman membaca ulang foto yang sama, bukan meminta unggah lagi
      window.history.replaceState(null, "", receiptHref(scope, uploaded.id));
      await read(uploaded.id, token);
    },
    [read, scope, setLocalPhoto],
  );

  const reset = useCallback(() => {
    run.current += 1;
    setLocalPhoto(null);
    setPhase({ name: "pick", error: null });
    window.history.replaceState(null, "", receiptHref(scope));
  }, [scope, setLocalPhoto]);

  // ref bertahan saat StrictMode memasang ulang efek, jadi foto awal hanya dibaca sekali
  const booted = useRef(false);
  useEffect(() => {
    const pickUp = () => {
      const file = takePendingReceiptFile();
      if (file) void start(file);
    };
    if (!booted.current) {
      booted.current = true;
      pickUp();
      if (initialAttachmentId && run.current === 0) void read(initialAttachmentId, 0);
    }
    return subscribePendingReceiptFile(pickUp);
  }, [initialAttachmentId, read, start]);

  return { phase, photoUrl, start, reset };
}
