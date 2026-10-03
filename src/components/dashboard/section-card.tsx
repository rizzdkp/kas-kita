import type { ReactNode } from "react";
import { Asset3D } from "@/components/assets/asset-3d";
import type { Asset3DName } from "@/components/assets/asset-names";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

type SectionCardProps = {
  id: string;
  title: ReactNode;
  /** Kanan judul: tautan atau tombol rumus. */
  action?: ReactNode;
  /** Aset 3D kecil di kiri judul; hanya untuk kartu yang isinya benda (tagihan, target, akun, wawasan). */
  art?: Asset3DName;
  children: ReactNode;
  className?: string;
};

/** Bagian Ringkasan di dalam kartu konten; judul adalah h2 supaya urutan heading halaman utuh. */
export function SectionCard({ id, title, action, art, children, className }: SectionCardProps) {
  return (
    <Card as="section" aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {art ? <Asset3D name={art} size={28} /> : null}
          <h2 id={id} className="text-card text-primary">
            {title}
          </h2>
        </div>
        {action ? <div className="-my-2 -mr-2 flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </Card>
  );
}
