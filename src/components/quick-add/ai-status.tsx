"use client";

import { Button } from "@/components/ui/button";

/** Strip di atas bar selama model AI membaca; spinner sudah ada di bar, di sini hanya penjelasan dan jalan keluar. */
export function AiStatus({ lines, onSkip }: { lines: number; onSkip: () => void }) {
  return (
    <div
      data-testid="quick-add-ai-status"
      className="kk-pop flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card border border-border bg-surface py-1.5 pl-4 pr-1.5 shadow-glass"
    >
      <p role="status" className="text-small text-secondary">
        {lines > 1 ? `Model AI membaca ${lines} baris yang belum lengkap.` : "Model AI membaca baris yang belum lengkap."}
        <span className="hidden sm:inline"> Esc untuk isi sendiri.</span>
      </p>
      <Button variant="ghost" onClick={onSkip} aria-keyshortcuts="Escape">
        Isi sendiri
      </Button>
    </div>
  );
}
