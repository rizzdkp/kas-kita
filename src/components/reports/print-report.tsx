import type { ReactNode } from "react";
import { formatDateWithYear } from "@/lib/dates";
import { formatPercent, formatRupiah, percentOf } from "@/lib/money";
import type { CategoryWithPrevious, MonthlyReport } from "@/server/queries/reports";
import { formatMonthLong } from "./months";
import "./print.css";

function change(current: bigint, previous: bigint): string {
  const p = percentOf(current - previous, previous);
  if (p === null) return "—";
  if (Math.abs(p) < 0.05) return "0%";
  return `${p > 0 ? "↑" : p < 0 ? "↓" : ""} ${formatPercent(Math.abs(p))}`.trim();
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-card text-primary">{caption}</h3>
      <table className="w-full border-collapse text-small">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`border-b border-border py-2 font-medium text-secondary ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-border">
              {cells.map((c, i) => (
                <td key={i} className={`py-2 text-primary ${i === 0 ? "text-left" : "tabular text-right"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function categoryRows(list: CategoryWithPrevious[]): ReactNode[][] {
  const total = list.reduce((s, c) => s + c.total, 0n);
  const rows: ReactNode[][] = list.map((c) => [
    c.name,
    formatRupiah(c.total),
    formatPercent(percentOf(c.total, total) ?? 0),
    formatRupiah(c.previous),
    change(c.total, c.previous),
  ]);
  rows.push(["Total", formatRupiah(total), "", "", ""]);
  return rows;
}

/** Ringkasan bulanan untuk dicetak atau disimpan sebagai PDF lewat dialog cetak browser (F-REP-1 AC3). */
export function PrintReport({ r, scopeLabel, printedOn }: { r: MonthlyReport; scopeLabel: string; printedOn: Date }) {
  const prev = r.ranges.previous.label;
  const rate = r.savingsRate.value;
  const prevRate = percentOf(r.previousIncome - r.previousExpense, r.previousIncome);
  return (
    <article className="kk-print-doc flex flex-col gap-8 rounded-card border border-border bg-surface p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-title text-primary">Laporan keuangan {r.label}</h2>
        <p className="text-small text-secondary">
          Cakupan {scopeLabel} · periode {r.ranges.current.label}, dibanding {prev} · dicetak {formatDateWithYear(printedOn)}
        </p>
      </header>
      <Table
        caption="Ringkasan"
        head={["", r.ranges.current.label, prev, "Perubahan"]}
        rows={[
          ["Pemasukan", formatRupiah(r.income.value), formatRupiah(r.previousIncome), change(r.income.value, r.previousIncome)],
          ["Pengeluaran", formatRupiah(r.expense.value), formatRupiah(r.previousExpense), change(r.expense.value, r.previousExpense)],
          ["Selisih", formatRupiah(r.net.value), formatRupiah(r.previousIncome - r.previousExpense), ""],
          ["Rasio tabungan", rate === null ? "Belum ada pemasukan" : formatPercent(rate), prevRate === null ? "Belum ada pemasukan" : formatPercent(prevRate), ""],
        ]}
      />
      <Table caption="Pengeluaran per kategori" head={["Kategori", "Nominal", "Porsi", prev, "Perubahan"]} rows={categoryRows(r.expenseCategories.value)} />
      <Table caption="Pemasukan per kategori" head={["Kategori", "Nominal", "Porsi", prev, "Perubahan"]} rows={categoryRows(r.incomeCategories.value)} />
      <Table
        caption="Tren 12 bulan"
        head={["Bulan", "Pemasukan", "Pengeluaran", "Selisih"]}
        rows={r.trend.value.map((t) => [formatMonthLong(t.month), formatRupiah(t.income), formatRupiah(t.expense), formatRupiah(t.income - t.expense)])}
      />
      <p className="text-caption text-secondary">Semua angka dihitung Kas Kita dari transaksi terkonfirmasi, tanpa transfer dan Penyesuaian saldo.</p>
    </article>
  );
}
