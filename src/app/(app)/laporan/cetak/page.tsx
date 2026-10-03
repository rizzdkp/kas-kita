import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { todayJakarta } from "@/lib/dates";
import { parseScope, type Scope } from "@/lib/scope";
import { parseMonthParam } from "@/components/reports/months";
import { PrintButton } from "@/components/reports/print-button";
import { PrintReport } from "@/components/reports/print-report";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { requireViewer } from "@/server/auth/session";
import { getMonthlyReport } from "@/server/queries/reports";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CetakLaporanPage({ searchParams }: PageProps) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const scope: Scope = viewer.partner ? parseScope(params.scope) : "me";
  const now = new Date();
  const month = parseMonthParam(params.bulan, todayJakarta(now));
  const r = await getMonthlyReport(viewer, scope, month, todayJakarta(now));
  const scopeLabel = scope === "all" ? "Gabungan" : scope === "partner" ? (viewer.partner?.displayName ?? "Partner") : viewer.user.displayName;
  const back = new URLSearchParams({ bulan: month });
  if (scope !== "me") back.set("scope", scope);

  return (
    <div className="flex flex-col gap-4">
      <div className="kk-no-print flex flex-wrap items-center justify-between gap-2">
        <Link href={`/laporan?${back.toString()}`} className={buttonClassName("ghost")}>
          <Icon icon={ArrowLeft} />
          Kembali ke laporan
        </Link>
        <PrintButton />
      </div>
      <PrintReport r={r} scopeLabel={scopeLabel} printedOn={now} />
    </div>
  );
}
