"use client";

import { ChevronDown, CircleCheck, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { listSurface } from "@/components/budgets/meter-bar";
import { OwnerDot, type PlanningPeople } from "@/components/budgets/owner";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { formatDateWithYear } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { GoalItem } from "./types";

type AchievedSectionProps = {
  goals: GoalItem[];
  people: PlanningPeople;
  onReopen: (goal: GoalItem) => void;
  onDelete: (goal: GoalItem) => void;
};

/** Bagian "Tercapai" terlipat supaya target yang selesai tidak makan tempat (F-GOAL-1 AC3). */
export function AchievedSection({ goals, people, onReopen, onDelete }: AchievedSectionProps) {
  if (goals.length === 0) return null;
  return (
    <details className="group">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-md text-card text-primary sm:h-10 [&::-webkit-details-marker]:hidden">
        <Icon icon={ChevronDown} className="-rotate-90 text-secondary transition-transform duration-(--dur-fast) group-open:rotate-0" />
        Tercapai
        <span className="font-normal text-secondary">({goals.length})</span>
      </summary>
      <ul className={`${listSurface} mt-3 divide-y divide-border`}>
        {goals.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2 text-body text-primary">
                <OwnerDot ownerId={g.ownerId} people={people} />
                {g.name}
              </span>
              <span className="tabular text-small text-secondary">{formatRupiah(g.targetAmount)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Badge tone="positive" icon={CircleCheck}>
                {g.achievedAt ? `Tercapai ${formatDateWithYear(g.achievedAt)}` : "Tercapai"}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton icon={MoreHorizontal} label={`Aksi untuk ${g.name}`} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {g.achievedAt ? (
                    <DropdownMenuItem icon={RotateCcw} onSelect={() => onReopen(g)}>
                      Tandai belum tercapai
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => onDelete(g)}>
                    Hapus target
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
