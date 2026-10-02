"use client";

import { CircleAlert } from "lucide-react";
import { formatDateWithYear, parseDateKey } from "@/lib/dates";
import { Amount } from "@/components/money/amount";
import { Icon } from "@/components/ui/icon";
import type { MappingPreview } from "@/server/import/csv/preview";

type MappingResultProps = {
  result: MappingPreview["result"];
  problem: string | null;
  pending: boolean;
};

function dateLabel(key: string, time: string | null): string {
  const d = parseDateKey(key);
  const text = d ? formatDateWithYear(d) : key;
  return time ? `${text}, ${time.replace(":", ".")}` : text;
}

const SKIP_KIND_NOTE = {
  invalid: null,
  summary: "Bukan transaksi",
  pending: "Bukan transaksi",
} as const;

/** Hasil baca dengan pemetaan saat ini; baris yang dilewati selalu disebut beserta alasannya. */
export function MappingResult({ result, problem, pending }: MappingResultProps) {
  return (
    <section aria-labelledby="pemetaan-hasil" aria-busy={pending} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="pemetaan-hasil" className="text-section text-primary">
          Hasil baca
        </h2>
        {result ? (
          <p role="status" className="text-small text-secondary">
            {result.rowCount} baris terbaca{result.skippedCount > 0 ? ` · ${result.skippedCount} baris dilewati` : ""}
          </p>
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="flex items-center gap-2 text-small text-error">
          <Icon icon={CircleAlert} size={16} className="shrink-0" />
          <span>{problem}</span>
        </p>
      ) : null}

      {result && result.rows.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full border-collapse text-left text-small">
            <caption className="sr-only">Lima baris pertama setelah dipetakan</caption>
            <thead>
              <tr className="border-b border-border text-caption text-secondary">
                <th scope="col" className="px-3 py-2 font-normal">
                  Tanggal
                </th>
                <th scope="col" className="px-3 py-2 font-normal">
                  Deskripsi
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Nominal
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums text-secondary">{dateLabel(row.date, row.time)}</td>
                  <td className="px-3 py-2 align-top text-primary">
                    <span className="line-clamp-2 break-words">{row.description || "Tanpa deskripsi"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top text-primary">
                    <Amount value={row.amount} sign="always" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result && result.skippedCount > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-card text-primary">{result.skippedCount} baris dilewati</h3>
          <p className="text-small text-secondary">
            {result.blockingCount > 0
              ? "Baris ini tidak ikut diimpor. Kalau seharusnya transaksi, cek format tanggal, pemisah desimal, atau kolom nominal."
              : "Baris ringkasan dan transaksi tertunda tidak ikut diimpor. Transaksi tertunda muncul di mutasi berikutnya setelah dibukukan bank."}
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {result.skipped.map((s) => (
              <li key={s.line} className="flex flex-col gap-1 px-3 py-2 text-small">
                <span className="text-primary">
                  Baris {s.line}: {s.reason}
                  {SKIP_KIND_NOTE[s.kind] ? <span className="text-secondary"> ({SKIP_KIND_NOTE[s.kind]})</span> : null}
                </span>
                <span className="truncate text-caption tabular-nums text-secondary">{s.cells.filter((c) => c.trim() !== "").join(" · ")}</span>
              </li>
            ))}
          </ul>
          {result.skippedCount > result.skipped.length ? (
            <p className="text-caption text-secondary">Menampilkan {result.skipped.length} dari {result.skippedCount} baris yang dilewati.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
