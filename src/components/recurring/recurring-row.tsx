"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { OwnerDot } from "@/components/budgets/owner";
import { shortDateFromKey } from "@/components/budgets/list-helpers";
import { Amount } from "@/components/money/amount";
import type { People } from "@/components/transactions/types";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { formatCountdown } from "@/lib/dates";
import { diffDaysKey } from "@/server/metrics/_time";
import type { RecurringRuleItem } from "@/server/queries/recurring";

type RecurringRowProps = {
  rule: RecurringRuleItem;
  people: People;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
};

function signed(rule: RecurringRuleItem): bigint {
  return rule.template.kind === "expense" ? -rule.amount : rule.amount;
}

export function RecurringRow({ rule, people, today, onEdit, onDelete }: RecurringRowProps) {
  const transfer = rule.template.kind === "transfer";
  const days = diffDaysKey(today, rule.nextRunOn);
  const where = transfer ? `${rule.accountName} ke ${rule.toAccountName ?? "akun lain"}` : `${rule.accountName}${rule.categoryName && rule.categoryName !== rule.label ? ` · ${rule.categoryName}` : ""}`;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <OwnerDot ownerId={rule.ownerId} people={people} />
          <span className="min-w-0 break-words text-card text-primary">{rule.label}</span>
          {rule.autoConfirm ? <Badge>Konfirmasi otomatis</Badge> : null}
        </p>
        <p className="text-small text-secondary">
          {rule.recurrenceLabel} · {where}
        </p>
        {rule.pendingDrafts > 0 ? (
          <Link
            href={rule.ownerId === null ? "/transaksi?status=draft&scope=all" : "/transaksi?status=draft"}
            className="w-fit text-small text-accent underline-offset-4 hover:underline"
          >
            {rule.pendingDrafts} menunggu konfirmasi
          </Link>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Amount value={signed(rule)} sign={transfer ? "none" : "always"} className="whitespace-nowrap text-body text-primary" />
          <span className="whitespace-nowrap text-small text-secondary">
            Berikutnya {shortDateFromKey(rule.nextRunOn)}
            {days >= 0 && days <= 7 ? ` · ${formatCountdown(days)}` : ""}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton icon={MoreHorizontal} label={`Aksi untuk ${rule.label}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem icon={Pencil} onSelect={onEdit}>
              Ubah jadwal
            </DropdownMenuItem>
            <DropdownMenuItem icon={Trash2} tone="danger" onSelect={onDelete}>
              Hapus jadwal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
