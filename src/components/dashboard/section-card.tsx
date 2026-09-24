import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

type SectionCardProps = {
  id: string;
  title: ReactNode;
  /** Kanan judul: tautan atau tombol rumus. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Bagian Ringkasan di dalam kartu konten; judul adalah h2 supaya urutan heading halaman utuh. */
export function SectionCard({ id, title, action, children, className }: SectionCardProps) {
  return (
    <Card as="section" aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className="text-card text-primary">
          {title}
        </h2>
        {action ? <div className="-my-2 -mr-2 flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </Card>
  );
}
