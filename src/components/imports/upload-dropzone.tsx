"use client";

import { useRef, useState } from "react";
import { FileText, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { formatFileSize } from "./upload-request";

type UploadDropzoneProps = {
  file: File | null;
  onFile: (file: File) => void;
  disabled?: boolean;
};

/** Seret atau pilih satu file; jenisnya diperiksa server dari isi file, bukan dari ekstensi. */
export function UploadDropzone({ file, onFile, disabled }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const pick = () => inputRef.current?.click();
  const take = (files: FileList | null) => {
    const first = files?.[0];
    if (first) onFile(first);
  };

  return (
    <section aria-labelledby="impor-file" className="flex flex-col gap-3">
      <h2 id="impor-file" className="text-section text-primary">
        File mutasi
      </h2>
      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) take(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col gap-4 rounded-card border border-dashed px-4 py-6 sm:px-(--space-card)",
          "transition-colors duration-(--dur-fast) ease-(--ease-out)",
          dragging ? "border-accent bg-surface-sunken" : "border-border-strong bg-surface",
          file ? "sm:flex-row sm:items-center" : "items-center py-10 text-center",
        )}
      >
        {file ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Icon icon={FileText} className="shrink-0 text-secondary" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-card text-primary">{file.name}</span>
                <span className="text-small text-secondary">{formatFileSize(file.size)}</span>
              </div>
            </div>
            <Button variant="secondary" onClick={pick} disabled={disabled} className="self-start sm:self-auto">
              Ganti file
            </Button>
          </>
        ) : (
          <>
            <Icon icon={FileUp} size={24} className="text-secondary" />
            <div className="flex max-w-[48ch] flex-col gap-1">
              <p className="text-card text-primary">
                <span className="pointer-coarse:hidden">Seret file CSV atau PDF ke sini</span>
                <span className="hidden pointer-coarse:inline">Pilih file CSV atau PDF</span>
              </p>
              <p className="text-small text-secondary">Mutasi dari internet banking atau e-statement, maksimal 20 MB. PDF berpassword akan dimintai password-nya.</p>
            </div>
            <Button variant="secondary" onClick={pick} disabled={disabled}>
              Pilih file
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
