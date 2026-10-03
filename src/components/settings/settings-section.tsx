import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type SettingsSectionProps = {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Satu bagian Pengaturan: judul yang jadi target tautan anchor, keterangan, lalu isi di kartu solid. */
export function SettingsSection({ id, title, description, children, className }: SettingsSectionProps) {
  const headingId = `${id}-judul`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-24 flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1 px-1">
        <h2 id={headingId} className="text-section text-primary">
          {title}
        </h2>
        {description ? <p className="max-w-[65ch] text-small text-secondary">{description}</p> : null}
      </div>
      <div className="rounded-card border border-border bg-surface p-4 sm:p-(--space-card)">{children}</div>
    </section>
  );
}
