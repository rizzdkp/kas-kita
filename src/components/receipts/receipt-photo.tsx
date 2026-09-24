"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { PhotoViewer } from "./photo-viewer";

/** Kolom foto pratinjau: menempel saat field di-scroll di desktop, bisa diperbesar. */
export function ReceiptPhoto({ src, className }: { src: string | null; className?: string }) {
  const [zoom, setZoom] = useState(false);
  if (!src) return null;
  return (
    <div className={cn("lg:sticky lg:top-24", className)}>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="group relative block w-full overflow-hidden rounded-card border border-border bg-surface-sunken"
        aria-label="Perbesar foto struk"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Foto struk" className="mx-auto max-h-[40dvh] w-auto object-contain lg:max-h-[calc(100dvh-160px)]" />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-surface px-2 py-1 text-caption text-secondary transition-colors duration-(--dur-fast) group-hover:text-primary">
          <Icon icon={Maximize2} size={16} />
          Perbesar
        </span>
      </button>
      <PhotoViewer src={src} open={zoom} onOpenChange={setZoom} />
    </div>
  );
}
