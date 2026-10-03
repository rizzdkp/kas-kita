import type { Metadata } from "next";
import { parseScope } from "@/lib/scope";
import { parseTransactionQuery, toServerFilters } from "@/components/transactions/filter-params";
import { requireViewer } from "@/server/auth/session";
import { listTags } from "@/server/queries/tags";
import { loadTransactionFormOptions } from "@/server/queries/transaction-form";
import { countDrafts, listTransactions } from "@/server/queries/transactions";
import { TransactionsView } from "./transactions-view";

export const metadata: Metadata = { title: "Transaksi" };

const FIRST_PAGE = 60;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TransaksiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const requested = parseScope(typeof params.scope === "string" ? params.scope : undefined);
  const scope = viewer.partner ? requested : "me";
  const query = parseTransactionQuery(params);

  const [formOptions, tags, draftCount] = await Promise.all([
    loadTransactionFormOptions(viewer, scope),
    listTags(),
    countDrafts(viewer, scope),
  ]);
  const filters = toServerFilters(scope, query, tags);
  const initialPage = await listTransactions(viewer, filters, { limit: FIRST_PAGE });

  return (
    <TransactionsView
      scope={scope}
      query={query}
      filters={filters}
      initialPage={initialPage}
      formOptions={formOptions}
      tags={tags}
      draftCount={draftCount}
    />
  );
}
