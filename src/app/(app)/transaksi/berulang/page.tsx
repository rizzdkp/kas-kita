import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RecurringView } from "@/components/recurring/recurring-view";
import type { RecurringInitial } from "@/components/recurring/form-model";
import { Icon } from "@/components/ui/icon";
import { dateKey, todayJakarta } from "@/lib/dates";
import { parseScope } from "@/lib/scope";
import { requireViewer } from "@/server/auth/session";
import type { Viewer } from "@/server/auth/viewer";
import { listRecurringRules } from "@/server/queries/recurring";
import { loadTransactionFormOptions } from "@/server/queries/transaction-form";
import { getTransaction } from "@/server/queries/transactions";
import { buildRecurrenceRule, firstRunAfter } from "@/server/recurring/schedule";

export const metadata: Metadata = { title: "Transaksi berulang" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Jadikan berulang": isian dari transaksi, bulanan mulai kejadian berikutnya setelah tanggal transaksi. */
async function prefillFrom(viewer: Viewer, id: string | undefined, today: string): Promise<RecurringInitial | null> {
  if (!id || !UUID.test(id)) return null;
  const tx = await getTransaction(viewer, id).catch(() => null);
  if (!tx || tx.deletedAt) return null;
  const date = dateKey(tx.occurredAt);
  return {
    kind: tx.kind,
    amount: tx.amount,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId,
    categoryId: tx.categoryId,
    note: tx.note,
    beneficiary: tx.beneficiary,
    tagNames: tx.tags.map((t) => t.name),
    frequency: "monthly",
    interval: 1,
    nextRunOn: firstRunAfter(buildRecurrenceRule("monthly", date), date, today),
    autoConfirm: false,
  };
}

export default async function BerulangPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const scope = viewer.partner ? parseScope(typeof params.scope === "string" ? params.scope : undefined) : "me";
  const today = todayJakarta();
  const [rules, options, prefill] = await Promise.all([
    listRecurringRules(viewer, scope),
    loadTransactionFormOptions(viewer, scope),
    prefillFrom(viewer, typeof params.dari === "string" ? params.dari : undefined, today),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-1">
        <Link
          href={scope === "me" ? "/transaksi" : `/transaksi?scope=${scope}`}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-card px-1 text-small text-secondary hover:text-primary sm:min-h-0"
        >
          <Icon icon={ChevronLeft} size={16} />
          Semua transaksi
        </Link>
      </div>
      <RecurringView scope={scope} rules={rules} options={options} today={today} prefill={prefill} />
    </div>
  );
}
