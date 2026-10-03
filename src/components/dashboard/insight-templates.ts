import { formatCountdown } from "@/lib/dates";
import { formatPercent, formatRupiah } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { transactionHref } from "@/components/reports/transaction-link";
import { addDaysKey, monthStartKey } from "@/server/metrics/_time";

export const WEEK_DAYS = 7;
export const MAX_INSIGHTS = 3;

export interface Insight {
  key: string;
  text: string;
  href: string;
}

export interface WeeklyFacts {
  scope: Scope;
  today: string;
  /** Kategori dengan kenaikan terbesar 7 hari terakhir dibanding 7 hari sebelumnya. */
  topIncrease: { categoryId: string; name: string; current: bigint; previous: bigint } | null;
  weekTotal: bigint;
  weekCount: number;
  /** Anggaran yang lajunya lebih cepat dari hari berlalu atau sudah lewat. */
  fastBudget: { categoryId: string; name: string; usedPercent: number; elapsedPercent: number; over: boolean } | null;
  dueBill: { name: string; amount: bigint; daysUntilDue: number; categoryId: string | null } | null;
}

/** F-AI-2 AC4: templat kalimat tetap; semua angka disisipkan kode dari fakta. */
export function buildInsights(f: WeeklyFacts): Insight[] {
  const weekFrom = addDaysKey(f.today, -(WEEK_DAYS - 1));
  const out: Insight[] = [];
  if (f.topIncrease) {
    const t = f.topIncrease;
    out.push({
      key: "category",
      text:
        t.previous > 0n
          ? `Pengeluaran ${t.name} 7 hari terakhir ${formatRupiah(t.current)}, naik ${formatRupiah(t.current - t.previous)} dari 7 hari sebelumnya.`
          : `Pengeluaran ${t.name} 7 hari terakhir ${formatRupiah(t.current)}, sebelumnya tidak ada.`,
      href: transactionHref({ scope: f.scope, categoryIds: [t.categoryId], from: weekFrom, to: f.today }),
    });
  }
  if (f.fastBudget) {
    const b = f.fastBudget;
    out.push({
      key: "budget",
      text: b.over
        ? `Anggaran ${b.name} sudah lewat, terpakai ${formatPercent(b.usedPercent)}.`
        : `Anggaran ${b.name} sudah terpakai ${formatPercent(b.usedPercent)}, padahal bulan baru berjalan ${formatPercent(b.elapsedPercent)}.`,
      href: transactionHref({ scope: f.scope, categoryIds: [b.categoryId], from: monthStartKey(f.today), to: f.today }),
    });
  }
  if (f.weekCount > 0) {
    out.push({
      key: "week",
      text: `Total pengeluaran 7 hari terakhir ${formatRupiah(f.weekTotal)} dari ${f.weekCount} transaksi.`,
      href: transactionHref({ scope: f.scope, kinds: ["expense"], from: weekFrom, to: f.today }),
    });
  }
  if (out.length < MAX_INSIGHTS && f.dueBill) {
    const b = f.dueBill;
    out.push({
      key: "bill",
      text: `Tagihan ${b.name} ${formatRupiah(b.amount)} jatuh tempo ${formatCountdown(b.daysUntilDue)}.`,
      href: b.categoryId
        ? transactionHref({ scope: f.scope, categoryIds: [b.categoryId] })
        : transactionHref({ scope: f.scope, q: b.name }),
    });
  }
  return out.slice(0, MAX_INSIGHTS);
}

