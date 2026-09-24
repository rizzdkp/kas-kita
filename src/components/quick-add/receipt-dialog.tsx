"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, buttonClassName } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { setPendingReceiptFile } from "@/components/receipts/pending-file";
import { OFFLINE_RECEIPT_COPY, RECEIPT_PATH, SETUP_RECEIPT_COPY, receiptHref } from "@/components/receipts/receipt-copy";
import { getReceiptStatusAction } from "@/server/actions/receipts";

type ReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const RECEIPT_CAPTURE_EVENT = "kaskita:receipt-capture";

/** Dipanggil tombol kamera; event sinkron supaya input file masih dalam gestur pengguna (syarat membuka kamera). */
export function requestReceiptCapture(): void {
  window.dispatchEvent(new Event(RECEIPT_CAPTURE_EVENT));
}

function prefersCamera(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Tombol foto struk (UX-FLOWS 5). Mobile: kamera belakang langsung. Desktop: halaman /struk untuk pilih atau seret file.
 * F-IN-3 AC5: sebelum model vision dipasang, tombol membuka dialog ke pengaturan AI. Offline: dialog penjelasan.
 */
export function ReceiptDialog({ open, onOpenChange }: ReceiptDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [vision, setVision] = useState<boolean | null>(null);
  const [reason, setReason] = useState<"setup" | "offline">("setup");
  const scope = params.get("scope");

  // dicek ulang setiap pindah halaman supaya model yang baru dipasang di pengaturan langsung berlaku
  useEffect(() => {
    let alive = true;
    getReceiptStatusAction()
      .then((r) => alive && setVision(r.vision))
      .catch(() => alive && setVision(null));
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const onCapture = () => {
      if (!navigator.onLine) {
        setReason("offline");
        onOpenChange(true);
      } else if (vision === false) {
        setReason("setup");
        onOpenChange(true);
      } else if (vision && (prefersCamera() || pathname === RECEIPT_PATH)) {
        inputRef.current?.click();
      } else {
        router.push(receiptHref(scope));
      }
    };
    window.addEventListener(RECEIPT_CAPTURE_EVENT, onCapture);
    return () => window.removeEventListener(RECEIPT_CAPTURE_EVENT, onCapture);
  }, [vision, scope, pathname, router, onOpenChange]);

  const copy = reason === "offline" ? OFFLINE_RECEIPT_COPY : SETUP_RECEIPT_COPY;
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setPendingReceiptFile(file);
          if (pathname !== RECEIPT_PATH) router.push(receiptHref(scope));
        }}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={copy.title}
          description={copy.body}
          footer={
            reason === "offline" ? (
              <DialogClose asChild>
                <Button variant="primary">Tutup</Button>
              </DialogClose>
            ) : (
              <>
                <DialogClose asChild>
                  <Button variant="ghost">Batal</Button>
                </DialogClose>
                <Link href="/pengaturan#ai" onClick={() => onOpenChange(false)} className={buttonClassName("primary")}>
                  Buka pengaturan AI
                </Link>
              </>
            )
          }
        />
      </Dialog>
    </>
  );
}
