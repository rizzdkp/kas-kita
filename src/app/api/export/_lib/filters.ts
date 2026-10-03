import type { TransactionLinkFilters } from "@/components/reports/transaction-link";
import type { TransactionFilters } from "@/server/queries/transactions";

/** Filter tautan ke filter query; tanpa partner cakupan selalu Saya. */
export function transactionFiltersFromLink(link: TransactionLinkFilters, hasPartner: boolean): TransactionFilters {
  return {
    scope: hasPartner ? (link.scope ?? "me") : "me",
    accountIds: link.accountIds,
    categoryIds: link.categoryIds,
    kinds: link.kinds,
    from: link.from,
    to: link.to,
    q: link.q,
    createdBy: link.createdBy,
    tagIds: link.tagIds,
    status: link.status,
  };
}
