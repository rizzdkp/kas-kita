import Link from "next/link";
import type { Insight } from "./insight-templates";
import { SectionCard } from "./section-card";

/** Wawasan dari templat kalimat tetap; setiap angka disisipkan kode (F-AI-2 AC4). */
export function InsightsSection({ insights }: { insights: Insight[] }) {
  return (
    <SectionCard id="wawasan" title="Wawasan minggu ini">
      {insights.length === 0 ? (
        <p className="text-small text-secondary">Belum ada transaksi 7 hari terakhir untuk dirangkum.</p>
      ) : (
        <ul className="flex flex-col">
          {insights.map((i) => (
            <li key={i.key} className="flex flex-col gap-1 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <p className="max-w-[65ch] text-body text-primary">{i.text}</p>
              <Link href={i.href} className="inline-flex min-h-11 shrink-0 items-center text-small text-accent hover:underline sm:min-h-0">
                Lihat transaksi
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
