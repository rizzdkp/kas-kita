"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type PhotoViewerProps = {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  footer?: ReactNode;
};

/** Foto ukuran penuh supaya angka kecil di struk bisa dicocokkan dengan field. */
export function PhotoViewer({ src, open, onOpenChange, title = "Foto struk", footer }: PhotoViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} footer={footer} className="w-[min(960px,calc(100vw-32px))]">
        {src ? (
          // lampiran disajikan route bersesi; next/image tidak membawa cookie ke optimizer
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Foto struk ukuran penuh" className="mx-auto max-h-[calc(100dvh-200px)] w-auto rounded-md object-contain" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
