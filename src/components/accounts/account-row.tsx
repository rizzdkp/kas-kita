"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Scale, Trash2, TrendingUp } from "lucide-react";
import { parseDateKey } from "@/lib/dates";
import { formatRupiah, percentOf, formatPercent } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import { Button, buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { ownerDot, personById } from "@/components/transactions/labels";
import type { People } from "@/components/transactions/types";
import type { AccountWithBalance } from "@/server/queries/accounts";
import { ACCOUNT_TYPE_LABEL, hasCreditTerms, isLiabilityType, relativeDayInline } from "./labels";

export type AccountAction = "reconcile" | "edit" | "archive" | "restore" | "delete";

type AccountRowProps = {
  account: AccountWithBalance;
  people: People;
  scope: Scope;
  onAction: (action: AccountAction, account: AccountWithBalance) => void;
};

/** Akun Bersama tidak tampil di cakupan Saya/Partner di Transaksi, jadi tautannya pindah ke Gabungan. */
export function transactionsHref(account: AccountWithBalance, scope: Scope): string {
  const target = account.ownerId === null ? "all" : scope;
  return `/transaksi?akun=${account.id}&scope=${target}`;
}

function ownerLabel(people: People, ownerId: string | null): string {
  return personById(people, ownerId)?.name ?? "Bersama";
}

function BalanceDetail({ account }: { account: AccountWithBalance }) {
  if (isLiabilityType(account.type)) {
    const debt = -account.balance;
    if (debt < 0n) return <span>Lebih bayar {formatRupiah(-debt)}</span>;
    if (hasCreditTerms(account.type) && account.creditLimit) {
      const used = percentOf(debt, account.creditLimit);
      return (
        <span>
          Terpakai {formatPercent(used ?? 0)} dari limit {formatRupiah(account.creditLimit)}
        </span>
      );
    }
    return <span>Sisa utang</span>;
  }
  if (account.type === "investment") {
    const valued = account.valuedOn ? parseDateKey(account.valuedOn) : null;
    return valued ? <span>Nilai pasar {relativeDayInline(valued)}</span> : <span>Belum ada nilai pasar</span>;
  }
  return null;
}

function displayValue(account: AccountWithBalance): bigint {
  // utang tampil sebagai nilai utang positif; kelebihan bayar dijelaskan di keterangan
  if (isLiabilityType(account.type)) return account.balance < 0n ? -account.balance : account.balance;
  return account.value;
}

export function AccountRow({ account, people, scope, onAction }: AccountRowProps) {
  const dot = ownerDot(people, account.ownerId);
  const archived = account.archivedAt !== null;
  const reconciled = account.lastReconciledAt ? `Dicocokkan ${relativeDayInline(account.lastReconciledAt)}` : "Belum pernah dicocokkan";
  const meta = [account.institutionName, ACCOUNT_TYPE_LABEL[account.type], ownerLabel(people, account.ownerId)].filter(Boolean).join(" · ");
  const canReconcile = !archived && account.type !== "investment";
  const investHref = `/investasi?scope=${account.ownerId === null ? "all" : scope}`;

  return (
    <li className="group/row relative flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-(--dur-fast) hover:bg-surface-sunken sm:gap-4 sm:px-(--space-card)">
      <IdentityDot color={dot.color} shared={dot.shared} label={dot.label} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={transactionsHref(account, scope)}
            className="truncate text-card text-primary outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent"
          >
            {account.name}
          </Link>
          <span className="truncate text-small text-secondary">{meta}</span>
          {canReconcile ? <span className="text-caption text-secondary">{reconciled}</span> : null}
        </div>
        <div className="flex flex-col sm:items-end">
          <Amount value={displayValue(account)} className="text-body text-primary" />
          <span className="text-caption text-secondary">
            <BalanceDetail account={account} />
          </span>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-1">
        {/* aksi utama baris muncul saat hover/fokus di desktop; di layar kecil lewat menu */}
        <span className="hidden w-44 justify-end opacity-0 transition-opacity duration-(--dur-fast) group-hover/row:opacity-100 group-focus-within/row:opacity-100 lg:flex">
          {canReconcile ? (
            <Button variant="ghost" icon={Scale} onClick={() => onAction("reconcile", account)}>
              Cocokkan saldo
            </Button>
          ) : account.type === "investment" && !archived ? (
            <Link href={investHref} className={buttonClassName("ghost")}>
              <Icon icon={TrendingUp} />
              Perbarui nilai
            </Link>
          ) : null}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton icon={MoreHorizontal} label={`Aksi untuk ${account.name}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {canReconcile ? (
              <DropdownMenuItem icon={Scale} onSelect={() => onAction("reconcile", account)}>
                Cocokkan saldo
              </DropdownMenuItem>
            ) : null}
            {account.type === "investment" && !archived ? (
              <DropdownMenuItem icon={TrendingUp} asChild>
                <Link href={investHref}>Perbarui nilai</Link>
              </DropdownMenuItem>
            ) : null}
            {!archived ? (
              <DropdownMenuItem icon={Pencil} onSelect={() => onAction("edit", account)}>
                Ubah akun
              </DropdownMenuItem>
            ) : null}
            {archived ? (
              <DropdownMenuItem icon={ArchiveRestore} onSelect={() => onAction("restore", account)}>
                Pulihkan
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem icon={Archive} onSelect={() => onAction("archive", account)}>
                Arsipkan
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => onAction("delete", account)}>
              Hapus akun
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
