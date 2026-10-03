import type { ReactNode } from "react";
import { cn } from "./cn";

type EmptyStateProps = {
  title: string;
  children: ReactNode;
  /** Satu aksi saja; biasanya satu Button. */
  action?: ReactNode;
  /** Ilustrasi spot dari @/components/illustrations, dipasang dengan `decorative` karena judul sudah menjelaskan. */
  illustration?: ReactNode;
  className?: string;
};

/** State kosong: ilustrasi opsional, judul, isi yang menjelaskan langkah berikutnya, satu aksi. */
export function EmptyState({ title, children, action, illustration, className }: EmptyStateProps) {
  return (
    <div className={cn("flex max-w-[48ch] flex-col items-start gap-2 py-8", illustration ? "pt-2" : null, className)}>
      {/* ilustrasi dibatasi 112px di layar kecil supaya tombol aksi tetap terlihat tanpa scroll */}
      {illustration ? <div className="-ml-2 mb-2 w-28 sm:w-36 [&>svg]:h-auto [&>svg]:w-full">{illustration}</div> : null}
      <h3 className="text-section text-primary">{title}</h3>
      <div className="text-body text-secondary">{children}</div>
      {action ? <div className="pt-4">{action}</div> : null}
    </div>
  );
}
