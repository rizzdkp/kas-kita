"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ImageUp } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { SETUP_RECEIPT_COPY } from "./receipt-copy";

type ReceiptPickerProps = {
  vision: boolean;
  error: string | null;
  onFile: (file: File) => void;
};

/** Desktop: pilih file atau seret ke area ini (UX-FLOWS 5 langkah 2). */
export function ReceiptPicker({ vision, error, onFile }: ReceiptPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  if (!vision) {
    return (
      <div className="flex max-w-[56ch] flex-col items-start gap-3 py-8">
        <h2 className="text-section text-primary">{SETUP_RECEIPT_COPY.title}</h2>
        <p className="text-body text-secondary">{SETUP_RECEIPT_COPY.body}</p>
        <Link href="/pengaturan#ai" className={buttonClassName("primary", "mt-2")}>
          Buka pengaturan AI
        </Link>
      </div>
    );
  }

  const takeFirstImage = (files: FileList | null) => {
    const file = files ? Array.from(files).find((f) => f.type.startsWith("image/") || f.type === "") : undefined;
    if (file) onFile(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFirstImage(event.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-72 flex-col items-center justify-center gap-4 rounded-card border border-dashed px-6 py-12 text-center",
          "transition-colors duration-(--dur-fast) ease-(--ease-out)",
          dragging ? "border-accent bg-surface-sunken" : "border-border-strong bg-surface",
        )}
      >
        <Icon icon={ImageUp} size={32} className="text-secondary" />
        <div className="flex max-w-[44ch] flex-col gap-1">
          <p className="text-card text-primary">Seret foto struk ke sini</p>
          <p className="text-small text-secondary">
            Foto dikecilkan di perangkat ini sebelum diunggah, lalu dibaca model AI. Semua hasil bisa kamu ubah sebelum disimpan.
          </p>
        </div>
        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          Pilih foto
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            takeFirstImage(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
