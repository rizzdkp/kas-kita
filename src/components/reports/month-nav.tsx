import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

type MonthNavProps = {
  label: string;
  prevHref: string;
  prevLabel: string;
  /** null kalau bulan berikutnya belum terjadi. */
  nextHref: string | null;
  nextLabel: string;
};

const arrow =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken text-primary hover:border-border-strong sm:size-10";

/** Navigasi bulan lewat ?bulan=YYYY-MM supaya laporan bisa ditautkan. */
export function MonthNav({ label, prevHref, prevLabel, nextHref, nextLabel }: MonthNavProps) {
  return (
    <nav aria-label="Pilih bulan" className="flex items-center gap-2">
      <Link href={prevHref} className={arrow} aria-label={`Bulan sebelumnya, ${prevLabel}`} scroll={false}>
        <Icon icon={ChevronLeft} />
      </Link>
      <h2 className="min-w-44 text-center text-section text-primary" aria-live="polite" data-testid="report-month">
        {label}
      </h2>
      {nextHref ? (
        <Link href={nextHref} className={arrow} aria-label={`Bulan berikutnya, ${nextLabel}`} scroll={false}>
          <Icon icon={ChevronRight} />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrow, "pointer-events-none opacity-(--disabled-opacity)")}>
          <Icon icon={ChevronRight} />
        </span>
      )}
    </nav>
  );
}
