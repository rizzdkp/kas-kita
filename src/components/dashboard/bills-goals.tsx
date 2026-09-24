import { formatCountdown, formatDateWithYear, parseDateKey } from "@/lib/dates";
import { formatPercent } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { BarTrack } from "@/components/charts/bar-track";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import { Badge } from "@/components/ui/badge";
import type { BillWithStatus } from "@/server/queries/bills";
import type { GoalWithProgress } from "@/server/queries/goals";
import { scopedHref } from "./links";
import { SeeAllLink } from "./see-all-link";
import { ownerStyle, type People } from "./people";
import { SectionCard } from "./section-card";

// sama dengan ambang "Perlu perhatian"
const DUE_SOON_DAYS = 3;

function OwnerMark({ ownerId, people, show }: { ownerId: string | null; people: People; show: boolean }) {
  if (!show) return null;
  const s = ownerStyle(ownerId, people);
  return <IdentityDot {...s.dot} label={`Milik ${s.name}`} />;
}

type ListProps<T> = { scope: Scope; people: People; className?: string } & T;

export function BillsSection({ bills, scope, people, className }: ListProps<{ bills: BillWithStatus[] }>) {
  return (
    <SectionCard
      id="tagihan-mendatang"
      className={className}
      title="Tagihan mendatang"
      action={<SeeAllLink href={scopedHref("/tagihan", scope)}>Semua tagihan</SeeAllLink>}
    >
      {bills.length === 0 ? (
        <p className="text-small text-secondary">Belum ada tagihan terjadwal.</p>
      ) : (
        <ul className="-mt-2 flex flex-col">
          {bills.map((b) => {
            const tone = b.overdue ? "attention" : b.daysUntilDue <= DUE_SOON_DAYS ? "due-soon" : "neutral";
            return (
              <li key={b.id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0 last:pb-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-2 text-small text-primary">
                    <OwnerMark ownerId={b.ownerId} people={people} show={scope === "all"} />
                    <span className="truncate">{b.name}</span>
                  </span>
                  <span className="text-caption text-secondary">
                    {formatDateWithYear(parseDateKey(b.nextDueOn) ?? new Date())}
                    {b.amountIsEstimate ? " · perkiraan" : ""}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Amount value={b.amount} className="text-small text-primary" />
                  <Badge tone={tone} icon={tone === "neutral" ? null : undefined}>
                    {formatCountdown(b.daysUntilDue)}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export function GoalsSection({ goals, scope, people, className }: ListProps<{ goals: GoalWithProgress[] }>) {
  return (
    <SectionCard
      id="target"
      className={className}
      title="Target"
      action={<SeeAllLink href={scopedHref("/target", scope)}>Semua target</SeeAllLink>}
    >
      {goals.length === 0 ? (
        <p className="text-small text-secondary">Belum ada target tabungan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((g) => (
            <li key={g.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-small text-primary">
                  <OwnerMark ownerId={g.ownerId} people={people} show={scope === "all"} />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="tabular shrink-0 text-small font-medium text-primary">{formatPercent(g.progressPercent)}</span>
              </div>
              <BarTrack percent={g.progressPercent} />
              <p className="text-caption text-secondary">
                <Amount value={g.progress} /> dari <Amount value={g.targetAmount} />
                {g.requiredMonthly !== null ? (
                  <span className="block">
                    setoran <Amount value={g.requiredMonthly} /> per bulan
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
