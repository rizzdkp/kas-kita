import type { Metadata } from "next";
import { todayJakarta } from "@/lib/dates";
import { parseScope } from "@/lib/scope";
import { AccountsView } from "@/components/accounts/accounts-view";
import { isAccountType } from "@/components/accounts/labels";
import type { People } from "@/components/transactions/types";
import { requireViewer } from "@/server/auth/session";
import { listAccounts, listInstitutions } from "@/server/queries/accounts";

export const metadata: Metadata = { title: "Akun" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AkunPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const scope = parseScope(first(params.scope));
  const [groups, institutions] = await Promise.all([
    listAccounts(viewer, { scope, view: "accounts_page", includeArchived: true }),
    listInstitutions(),
  ]);
  const people: People = {
    me: { id: viewer.user.id, name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner ? { id: viewer.partner.id, name: viewer.partner.displayName, color: viewer.partner.identityColor } : null,
  };
  const jenis = first(params.jenis);
  const openNew = first(params.baru) === "1" ? { type: isAccountType(jenis) ? jenis : undefined } : null;

  return (
    <AccountsView
      accounts={groups.all}
      people={people}
      institutions={institutions.map((i) => ({ id: i.id, name: i.name }))}
      scope={scope}
      today={todayJakarta()}
      openNew={openNew}
    />
  );
}
