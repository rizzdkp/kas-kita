"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import type { Scope } from "@/lib/scope";
import { Amount } from "@/components/money/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { People } from "@/components/transactions/types";
import { setAccountArchivedAction } from "@/server/actions/accounts";
import type { AccountType } from "@/server/db/schema";
import type { AccountGroup } from "@/server/metrics/types";
import type { AccountWithBalance } from "@/server/queries/accounts";
import type { InstitutionOption } from "./account-form-fields";
import { AccountFormSheet } from "./account-form-sheet";
import { AccountRow, type AccountAction } from "./account-row";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { GROUP_LABEL } from "./labels";
import { ReconcileSheet } from "./reconcile-sheet";

type AccountsViewProps = {
  accounts: AccountWithBalance[];
  people: People;
  institutions: InstitutionOption[];
  scope: Scope;
  today: string;
  /** Dari /akun?baru=1[&jenis=...]: buka form tambah langsung. */
  openNew: { type?: AccountType } | null;
};

type FormTarget = { account: AccountWithBalance | null; presetType?: AccountType };

const GROUPS: AccountGroup[] = ["liquid", "liability", "asset"];

// kewajiban dijumlah sebagai nilai utang positif, sesuai rumus PRD bagian 6
function subtotal(group: AccountGroup, list: AccountWithBalance[]): bigint {
  return list.reduce((sum, a) => sum + (group === "liability" ? -a.balance : a.value), 0n);
}

export function AccountsView({ accounts, people, institutions, scope, today, openNew }: AccountsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<FormTarget | null>(openNew ? { account: null, presetType: openNew.type } : null);
  const [reconcile, setReconcile] = useState<AccountWithBalance | null>(null);
  const [toDelete, setToDelete] = useState<AccountWithBalance | null>(null);

  const active = accounts.filter((a) => a.archivedAt === null);
  const archived = accounts.filter((a) => a.archivedAt !== null);

  function closeForm() {
    setForm(null);
    if (searchParams.has("baru") || searchParams.has("jenis")) {
      const next = new URLSearchParams(searchParams);
      next.delete("baru");
      next.delete("jenis");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  function setArchived(account: AccountWithBalance, archivedFlag: boolean, version = account.version) {
    startTransition(async () => {
      const result = await setAccountArchivedAction({ id: account.id, version, archived: archivedFlag });
      if (!result.ok) {
        toast.show({ title: result.error });
        return;
      }
      toast.show(
        archivedFlag
          ? { title: "Diarsipkan", action: { label: "Urungkan", onAction: () => setArchived(account, false, result.data.version) } }
          : { title: "Dipulihkan" },
      );
    });
  }

  function onAction(action: AccountAction, account: AccountWithBalance) {
    if (action === "edit") setForm({ account });
    else if (action === "reconcile") setReconcile(account);
    else if (action === "delete") setToDelete(account);
    else setArchived(account, action === "archive");
  }

  return (
    <div className="flex flex-col gap-8 pb-32">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[60ch] text-small text-secondary">Akun Bersama selalu tampil di halaman ini, apa pun cakupannya.</p>
        <Button variant="primary" icon={Plus} onClick={() => setForm({ account: null })}>
          Tambah akun
        </Button>
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Tambahkan akun pertama"
            action={
              <Button icon={Plus} onClick={() => setForm({ account: null })}>
                Tambah akun
              </Button>
            }
          >
            Mulai dari rekening yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti.
          </EmptyState>
        </Card>
      ) : (
        GROUPS.map((group) => {
          const list = active.filter((a) => a.group === group);
          if (list.length === 0) return null;
          const headingId = `akun-${group}`;
          return (
            <section key={group} aria-labelledby={headingId} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4 px-1">
                <h2 id={headingId} className="text-section text-primary">
                  {GROUP_LABEL[group]}
                </h2>
                <p className="text-body font-medium text-primary">
                  <span className="sr-only">Subtotal {GROUP_LABEL[group]}: </span>
                  <Amount value={subtotal(group, list)} />
                </p>
              </div>
              <Card className="overflow-hidden p-0 sm:p-0">
                <ul className="divide-y divide-border">
                  {list.map((a) => (
                    <AccountRow key={a.id} account={a} people={people} scope={scope} onAction={onAction} />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })
      )}

      {archived.length > 0 ? (
        <details className="group flex flex-col gap-3">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md px-1 text-control text-secondary hover:text-primary [&::-webkit-details-marker]:hidden">
            <Icon icon={ChevronRight} className="transition-transform duration-(--dur-fast) group-open:rotate-90" />
            Diarsipkan ({archived.length})
          </summary>
          <Card className="mt-3 overflow-hidden p-0 sm:p-0">
            <ul className="divide-y divide-border">
              {archived.map((a) => (
                <AccountRow key={a.id} account={a} people={people} scope={scope} onAction={onAction} />
              ))}
            </ul>
          </Card>
        </details>
      ) : null}

      <AccountFormSheet
        open={form !== null}
        onOpenChange={(o) => (o ? null : closeForm())}
        account={form?.account ?? null}
        presetType={form?.presetType}
        people={people}
        institutions={institutions}
        today={today}
      />
      <ReconcileSheet account={reconcile} onOpenChange={(o) => (o ? null : setReconcile(null))} />
      <DeleteAccountDialog account={toDelete} onOpenChange={(o) => (o ? null : setToDelete(null))} />
    </div>
  );
}
