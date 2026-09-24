"use client";

import { History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { OwnerDot, type PlanningPeople } from "@/components/budgets/owner";
import { shortDateFromKey } from "@/components/budgets/list-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { formatRupiah } from "@/lib/money";
import { DueCountdown } from "./due-countdown";
import { recurrenceLabel } from "./rrule";
import type { BillItem } from "./types";

type BillRowProps = {
  bill: BillItem;
  people: PlanningPeople;
  onPay: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
};

export function BillRow({ bill, people, onPay, onEdit, onHistory, onDelete }: BillRowProps) {
  const isCard = bill.creditCardAccountId !== null;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <OwnerDot ownerId={bill.ownerId} people={people} />
          <span className="text-card text-primary">{bill.name}</span>
          {bill.amountIsEstimate && !isCard ? <Badge>perkiraan</Badge> : null}
        </p>
        <p className="text-small text-secondary">
          Dari {bill.payFromAccountName} · {recurrenceLabel(bill.rrule, bill.nextDueOn)}
        </p>
        {isCard ? <p className="text-small text-secondary">{bill.cycleLabel}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="tabular whitespace-nowrap text-body text-primary">{formatRupiah(bill.amount)}</span>
          <span className="flex items-center gap-1 text-small">
            <DueCountdown days={bill.daysUntilDue} />
            <span className="whitespace-nowrap text-secondary">· {shortDateFromKey(bill.nextDueOn)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button onClick={onPay} aria-label={`Bayar ${bill.name}`}>
            Bayar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton icon={MoreHorizontal} label={`Aksi untuk ${bill.name}`} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem icon={Pencil} onSelect={onEdit}>
                Ubah tagihan
              </DropdownMenuItem>
              <DropdownMenuItem icon={History} onSelect={onHistory}>
                Riwayat pembayaran
              </DropdownMenuItem>
              <DropdownMenuItem icon={Trash2} tone="danger" onSelect={onDelete}>
                Hapus tagihan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
