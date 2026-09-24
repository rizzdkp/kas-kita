import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";

export interface DataTableColumn {
  label: string;
  /** Kolom angka rata kanan (DESIGN 3). */
  numeric?: boolean;
}

type ChartDataTableProps = {
  caption: string;
  columns: DataTableColumn[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
};

/** Tabel data alternatif untuk setiap grafik (DESIGN 10), tertutup secara bawaan. */
export function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-small text-secondary hover:text-primary sm:min-h-8 [&::-webkit-details-marker]:hidden">
        <Icon icon={ChevronDown} size={16} className="transition-transform duration-(--dur-fast) group-open:rotate-180" />
        <span className="group-open:hidden">Tampilkan tabel data</span>
        <span className="hidden group-open:inline">Sembunyikan tabel data</span>
      </summary>
      <div className="mt-2 max-h-80 overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-small">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  className={`border-b border-border px-3 py-2 font-medium text-secondary ${c.numeric ? "text-right" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-b-0">
                {r.cells.map((cell, i) => (
                  <td key={i} className={`px-3 py-2 text-primary ${columns[i]?.numeric ? "tabular text-right" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
