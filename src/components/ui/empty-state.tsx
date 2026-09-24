import type { ReactNode } from "react";
import { cn } from "./cn";

type EmptyStateProps = {
  title: string;
  children: ReactNode;
  /** Satu aksi saja; biasanya satu Button. */
  action?: ReactNode;
  className?: string;
};

/** State kosong: judul, isi yang menjelaskan langkah berikutnya, satu aksi. Tanpa ilustrasi. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex max-w-[48ch] flex-col items-start gap-2 py-8", className)}>
      <h3 className="text-section text-primary">{title}</h3>
      <div className="text-body text-secondary">{children}</div>
      {action ? <div className="pt-4">{action}</div> : null}
    </div>
  );
}
