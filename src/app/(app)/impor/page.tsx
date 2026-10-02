import type { Metadata } from "next";
import { ACCOUNT_TYPE_LABEL } from "@/components/accounts/labels";
import { UploadScreen, type ImportAccountOption } from "@/components/imports/upload-screen";
import { isUuid } from "@/components/transactions/filter-params";
import { ownerDot, personById } from "@/components/transactions/labels";
import type { People } from "@/components/transactions/types";
import { requireViewer } from "@/server/auth/session";
import { IMPORT_ACCOUNT_TYPES } from "@/server/import/csv/upload";
import { listAccounts } from "@/server/queries/accounts";
import { listTemplateInstitutionIds } from "@/server/queries/import-templates";

export const metadata: Metadata = { title: "Impor mutasi" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Impor mutasi (UX-FLOWS 6 langkah 1-2): pilih akun tujuan, lalu unggah CSV atau PDF. */
export default async function ImporPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer();
  // akun tujuan bisa milik siapa pun di rumah tangga, jadi daftar memakai Gabungan
  const [groups, templateInstitutions] = await Promise.all([listAccounts(viewer, { scope: "all", view: "accounts_page" }), listTemplateInstitutionIds()]);
  const people: People = {
    me: { id: viewer.user.id, name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner ? { id: viewer.partner.id, name: viewer.partner.displayName, color: viewer.partner.identityColor } : null,
  };
  const withTemplate = new Set(templateInstitutions);
  const options: ImportAccountOption[] = groups.all
    .filter((a) => (IMPORT_ACCOUNT_TYPES as readonly string[]).includes(a.type))
    .map((a) => {
      const owner = personById(people, a.ownerId);
      const ownerLabel = owner ? (owner.id === people.me.id ? "Kamu" : owner.name) : "Bersama";
      return {
        id: a.id,
        name: a.name,
        meta: [a.institutionName, ACCOUNT_TYPE_LABEL[a.type], ownerLabel].filter(Boolean).join(" · "),
        dot: ownerDot(people, a.ownerId),
        templateFor: a.institutionId && withTemplate.has(a.institutionId) ? a.institutionName : null,
      };
    });
  const akun = typeof params.akun === "string" && isUuid(params.akun) ? params.akun : null;
  const initialAccountId = options.find((o) => o.id === akun)?.id ?? (options.length === 1 ? options[0]!.id : null);

  return <UploadScreen accounts={options} initialAccountId={initialAccountId} />;
}
