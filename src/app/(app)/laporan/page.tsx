import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { todayJakarta } from "@/lib/dates";
import { parseScope, type Scope } from "@/lib/scope";
import { CategoryList } from "@/components/reports/category-list";
import { MonthNav } from "@/components/reports/month-nav";
import { formatMonthLong, parseMonthParam, shiftMonth } from "@/components/reports/months";
import { ReportSummary } from "@/components/reports/summary-card";
import { transactionHref } from "@/components/reports/transaction-link";
import { TrendSection } from "@/components/reports/trend-section";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { requireViewer } from "@/server/auth/session";
import { getMonthlyReport } from "@/server/queries/reports";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function reportHref(path: string, month: string, scope: Scope): string {
  const p = new URLSearchParams({ bulan: month });
  if (scope !== "me") p.set("scope", scope);
  return `${path}?${p.toString()}`;
}

export default async function LaporanPage({ searchParams }: PageProps) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const scope: Scope = viewer.partner ? parseScope(params.scope) : "me";
  const today = todayJakarta();
  const month = parseMonthParam(params.bulan, today);
  const r = await getMonthlyReport(viewer, scope, month, today);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const hasNext = next <= today.slice(0, 7);
  const range = r.ranges.current;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MonthNav
          label={r.label}
          prevHref={reportHref("/laporan", prev, scope)}
          prevLabel={formatMonthLong(prev)}
          nextHref={hasNext ? reportHref("/laporan", next, scope) : null}
          nextLabel={formatMonthLong(next)}
        />
        <div className="flex flex-wrap gap-2">
          <a
            href={transactionHref({ scope, from: range.from, to: range.to }, "/api/export/transaksi.csv")}
            download
            className={buttonClassName("secondary")}
          >
            <Icon icon={Download} />
            Unduh CSV
          </a>
          <Link href={reportHref("/laporan/cetak", month, scope)} className={buttonClassName("secondary")}>
            <Icon icon={Printer} />
            Cetak / simpan PDF
          </Link>
        </div>
      </div>

      <ReportSummary r={r} />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        <CategoryList
          id="pengeluaran-kategori"
          title="Pengeluaran per kategori"
          kind="expense"
          categories={r.expenseCategories}
          range={range}
          previousLabel={r.ranges.previous.label}
          scope={scope}
          className="lg:col-span-7"
        />
        <CategoryList
          id="pemasukan-kategori"
          title="Pemasukan per kategori"
          kind="income"
          categories={r.incomeCategories}
          range={range}
          previousLabel={r.ranges.previous.label}
          scope={scope}
          className="self-start lg:col-span-5"
        />
      </div>

      {process.env.KK_EXP ? null : <TrendSection trend={r.trend} month={month} />}
    </div>
  );
}
