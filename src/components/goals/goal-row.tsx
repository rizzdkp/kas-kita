"use client";

import { CircleCheck, History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { MeterBar } from "@/components/budgets/meter-bar";
import { OwnerDot, type PlanningPeople } from "@/components/budgets/owner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { formatDateWithYear, parseDateKey } from "@/lib/dates";
import { formatPercent, formatRupiah } from "@/lib/money";
import type { GoalItem } from "./types";

type GoalRowProps = {
  goal: GoalItem;
  people: PlanningPeople;
  today: string;
  onContribute: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onAchieved: () => void;
  onDelete: () => void;
};

function deadlineText(deadline: string, today: string): string {
  const d = parseDateKey(deadline);
  const label = d ? formatDateWithYear(d) : deadline;
  return deadline < today ? `Tenggat ${label} sudah lewat` : `Tenggat ${label}`;
}

export function GoalRow({ goal, people, today, onContribute, onEdit, onHistory, onAchieved, onDelete }: GoalRowProps) {
  const manual = goal.linkedAccountId === null;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2">
          <OwnerDot ownerId={goal.ownerId} people={people} />
          <span className="text-card text-primary">{goal.name}</span>
        </p>
        <p className="tabular text-body">
          <span className="text-primary">{formatRupiah(goal.progress)}</span>
          <span className="text-secondary"> dari {formatRupiah(goal.targetAmount)}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <MeterBar percent={goal.progressPercent} className="flex-1" />
        <span className="tabular w-14 text-right text-small text-primary">{formatPercent(goal.progressPercent)}</span>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-small text-secondary">
        <span>
          Sisa <span className="tabular text-primary">{formatRupiah(goal.remaining)}</span>
        </span>
        {goal.deadline ? <span>{deadlineText(goal.deadline, today)}</span> : null}
        {goal.requiredMonthly !== null ? (
          <span>
            Setoran bulanan yang dibutuhkan <span className="tabular text-primary">{formatRupiah(goal.requiredMonthly)}</span>
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-secondary">
          {manual ? "Progres dari setoran manual" : `Progres dari saldo ${goal.linkedAccountName ?? "akun penampung"}`}
        </p>
        <div className="flex items-center gap-1">
          {manual ? <Button onClick={onContribute}>Tambah setoran</Button> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton icon={MoreHorizontal} label={`Aksi untuk ${goal.name}`} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem icon={Pencil} onSelect={onEdit}>
                Ubah target
              </DropdownMenuItem>
              {manual ? (
                <DropdownMenuItem icon={History} onSelect={onHistory}>
                  Riwayat setoran
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem icon={CircleCheck} onSelect={onAchieved}>
                Tandai tercapai
              </DropdownMenuItem>
              <DropdownMenuItem icon={Trash2} tone="danger" onSelect={onDelete}>
                Hapus target
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
