import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

type MonthNavProps = {
  /** "YYYY-MM" */
  month: string;
  currentMonth: string;
  /** Membuat href untuk bulan lain; cakupan dipertahankan oleh pemanggil. */
  hrefFor: (month: string) => string;
};

const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return monthFormatter.format(new Date(Date.UTC(y, m - 1, 1)));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const arrow =
  "inline-flex size-11 items-center justify-center rounded-sm text-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-primary sm:size-10";

/** Navigasi bulan lewat ?bulan=YYYY-MM supaya tautan bisa dibagikan. */
export function MonthNav({ month, currentMonth, hrefFor }: MonthNavProps) {
  return (
    <nav aria-label="Pilih bulan" className="flex items-center gap-1">
      <Link href={hrefFor(shiftMonth(month, -1))} aria-label="Bulan sebelumnya" className={arrow} scroll={false}>
        <Icon icon={ChevronLeft} />
      </Link>
      <h2 className="min-w-40 text-center text-section text-primary" aria-live="polite">
        {monthLabel(month)}
      </h2>
      <Link href={hrefFor(shiftMonth(month, 1))} aria-label="Bulan berikutnya" className={arrow} scroll={false}>
        <Icon icon={ChevronRight} />
      </Link>
      {month !== currentMonth ? (
        <Link
          href={hrefFor(currentMonth)}
          scroll={false}
          className={cn("ml-1 inline-flex h-11 items-center rounded-md px-3 text-control text-accent hover:bg-surface-sunken sm:h-10")}
        >
          Bulan ini
        </Link>
      ) : null}
    </nav>
  );
}
