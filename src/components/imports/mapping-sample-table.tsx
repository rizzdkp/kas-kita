"use client";

import { cn } from "@/components/ui/cn";
import type { CsvMapping } from "@/server/import/types";
import { roleOf } from "./mapping-labels";

type MappingSampleTableProps = {
  columns: string[];
  sample: { line: number; cells: string[] }[];
  mapping: CsvMapping;
};

/** Lima baris pertama file apa adanya; kolom yang sudah dipetakan diberi label perannya. */
export function MappingSampleTable({ columns, sample, mapping }: MappingSampleTableProps) {
  return (
    <section aria-labelledby="pemetaan-file" className="flex min-w-0 flex-col gap-3">
      <h2 id="pemetaan-file" className="text-section text-primary">
        Isi file
      </h2>
      <div
        role="region"
        aria-labelledby="pemetaan-file"
        tabIndex={0}
        className="overflow-x-auto rounded-card border border-border bg-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <table className="w-full min-w-max border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-2 text-caption font-normal text-secondary">
                <span className="sr-only">Nomor baris</span>
              </th>
              {columns.map((name) => {
                const role = roleOf(mapping, name);
                return (
                  <th key={name} scope="col" className="px-3 py-2 align-bottom font-medium text-primary">
                    <span className="flex flex-col gap-1">
                      <span className={cn("w-fit rounded-xs px-1 text-caption font-medium", role ? "bg-accent/10 text-primary" : "invisible")} aria-hidden={!role}>
                        {role ?? "-"}
                      </span>
                      <span className="whitespace-nowrap">{name}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sample.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-4 text-secondary">
                  Tidak ada baris di bawah baris header. Pilih baris header lain.
                </td>
              </tr>
            ) : (
              sample.map((row) => (
                <tr key={row.line} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-caption tabular-nums text-secondary">{row.line}</td>
                  {columns.map((name, i) => (
                    <td key={name} className="max-w-72 truncate whitespace-nowrap px-3 py-2 tabular-nums text-primary">
                      {row.cells[i] ?? ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
