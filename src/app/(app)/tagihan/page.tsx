import type { Metadata } from "next";
import { flattenCategories } from "@/components/budgets/options";
import { planningPeople } from "@/components/budgets/people";
import { BillsView } from "@/components/bills/bills-view";
import type { BillItem, PaidItem } from "@/components/bills/types";
import { formatRangeLabel, parseDateKey, periodRange, todayJakarta } from "@/lib/dates";
import { parseScope } from "@/lib/scope";
import { requireViewer } from "@/server/auth/session";
import { addDaysKey, addMonthsKey, keyOf } from "@/server/metrics/_time";
import { listAccounts } from "@/server/queries/accounts";
import { listBills, statementDateFor } from "@/server/queries/bills";
import { listCategories } from "@/server/queries/categories";
import { listBillPaymentHistory } from "@/server/queries/planning-history";

export const metadata: Metadata = { title: "Tagihan" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function cycleLabel(dueOn: string, statementDay: number | null): string {
  if (statementDay === null) return "Dihitung otomatis dari saldo kartu saat ini";
  const statementOn = statementDateFor(dueOn, statementDay);
  const cycleStart = addDaysKey(addMonthsKey(statementOn, -1, statementDay), 1);
  const start = parseDateKey(cycleStart);
  const end = parseDateKey(addDaysKey(statementOn, 1));
  if (!start || !end) return "Dihitung otomatis dari transaksi siklus cetak tagihan";
  return `Dihitung otomatis dari transaksi siklus ${formatRangeLabel({ start, end })}`;
}

export default async function TagihanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const scope = viewer.partner ? parseScope(params.scope) : "me";
  const now = new Date();
  const today = todayJakarta(now);
  const period = periodRange(viewer.user.periodMode, viewer.user.paydayDay, now);

  const [bills, accounts, categoryTree] = await Promise.all([
    listBills(viewer, scope, { today }),
    listAccounts(viewer, { scope: "all" }),
    listCategories({ kind: "expense" }),
  ]);
  const history = await listBillPaymentHistory(bills.map((b) => b.id));
  const statementDays = new Map(accounts.all.map((a) => [a.id, a.statementDay]));

  const items: BillItem[] = bills.map((b) => ({
    ...b,
    cycleLabel: b.creditCardAccountId ? cycleLabel(b.nextDueOn, statementDays.get(b.creditCardAccountId) ?? null) : null,
    history: history.get(b.id) ?? [],
  }));
  const paid: PaidItem[] = items
    .flatMap((b) =>
      b.history
        .filter((p) => p.paidAt >= period.start && p.paidAt < period.end)
        .map((p) => ({ id: p.id, billId: b.id, billName: b.name, ownerId: b.ownerId, amount: p.amount, paidAt: p.paidAt, accountName: p.accountName })),
    )
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

  return (
    <BillsView
      scope={scope}
      people={planningPeople(viewer)}
      bills={items}
      paid={paid}
      periodLabel={formatRangeLabel(period)}
      periodLast={addDaysKey(keyOf(period.end), -1)}
      payAccounts={accounts.liquid.map((a) => ({ id: a.id, label: a.name }))}
      cardAccounts={accounts.liability
        .filter((a) => a.type === "credit_card" || a.type === "paylater")
        .map((a) => ({ id: a.id, label: a.name }))}
      categories={flattenCategories(categoryTree)}
      today={today}
    />
  );
}
