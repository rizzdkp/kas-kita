import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-section text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-caption text-secondary">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
