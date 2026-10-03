import type { Metadata } from "next";
import { todayJakarta } from "@/lib/dates";
import { parseScope } from "@/lib/scope";
import { InvestmentsView } from "@/components/investments/investments-view";
import type { People } from "@/components/transactions/types";
import { requireViewer } from "@/server/auth/session";
import { listInvestments } from "@/server/queries/investments";

export const metadata: Metadata = { title: "Investasi" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InvestasiPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const scope = parseScope(Array.isArray(params.scope) ? params.scope[0] : params.scope);
  const items = await listInvestments(viewer, scope);
  const people: People = {
    me: { id: viewer.user.id, name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner ? { id: viewer.partner.id, name: viewer.partner.displayName, color: viewer.partner.identityColor } : null,
  };
  return <InvestmentsView items={items} people={people} scope={scope} today={todayJakarta()} />;
}
