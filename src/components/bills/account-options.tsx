import { InstitutionBadge } from "@/components/brand/institution-badge";
import type { OptionGroup } from "@/components/transactions/grouped-select";
import type { AccountOption } from "./types";

/** Satu grup tanpa judul; lencana institusi di samping nama akun. */
export function billAccountGroups(accounts: AccountOption[]): OptionGroup[] {
  return [
    {
      options: accounts.map((a) => ({
        value: a.id,
        label: a.label,
        leading: <InstitutionBadge slug={a.institutionSlug} name={a.institutionName} type={a.type} size="sm" />,
      })),
    },
  ];
}
