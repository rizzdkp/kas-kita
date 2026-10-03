import { formatCountdown } from "@/lib/dates";
import type { Scope } from "@/lib/scope";
import { transactionHref } from "@/components/reports/transaction-link";
import type { Dashboard } from "@/server/queries/dashboard";
import type { AttentionItem } from "./attention-list";
import { scopedHref } from "./links";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Urutan: yang sudah telat atau lewat dulu, lalu yang segera, lalu draf. */
export function buildAttentionItems(a: Dashboard["attention"], scope: Scope): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const b of a.overdueBills) {
    items.push({
      key: `overdue-${b.id}`,
      status: capitalize(formatCountdown(b.daysUntilDue)),
      tone: "attention",
      text: `Tagihan ${b.name} belum dibayar`,
      amount: b.amount,
      href: scopedHref("/tagihan", scope),
    });
  }
  for (const budget of a.mandatoryOverBudgets) {
    items.push({
      key: `budget-${budget.id}`,
      status: "Lewat",
      tone: "attention",
      text: `Anggaran wajib ${budget.categoryName} lewat`,
      amount: budget.spent - budget.amount,
      href: scopedHref("/anggaran", scope),
    });
  }
  for (const b of a.dueSoonBills) {
    items.push({
      key: `due-${b.id}`,
      status: capitalize(formatCountdown(b.daysUntilDue)),
      tone: "due-soon",
      text: `Tagihan ${b.name} jatuh tempo`,
      amount: b.amount,
      href: scopedHref("/tagihan", scope),
    });
  }
  if (a.draftCount > 0) {
    items.push({
      key: "drafts",
      status: "Perlu dikonfirmasi",
      tone: "neutral",
      text: `${a.draftCount} transaksi perlu dikonfirmasi`,
      href: transactionHref({ scope, status: "draft" }),
    });
  }
  return items;
}
