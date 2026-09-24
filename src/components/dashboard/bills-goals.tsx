import Link from "next/link";
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
import { ownerStyle, type People } from "./people";
import { SectionCard } from "./section-card";

// sama dengan ambang "Perlu perhatian"
const DUE_SOON_DAYS = 3;

function OwnerMark({ ownerId, people, show }: { ownerId: string | null; people: People; show: boolean }) {
  if (!show) return null;
  const s = ownerStyle(ownerId, people);
  return <IdentityDot {...s.dot} label={`Milik ${s.name}`} />;
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center px-2 text-small text-accent hover:underline sm:min-h-8">
      {label}
    </Link>
  );
}

export function BillsSection({ bills, scope, people }: { bills: BillWithStatus[]; scope: Scope; people: People }) {
  return (
    <SectionCard id="tagihan-mendatang" title="Tagihan mendatang" action={<SeeAll href={scopedHref("/tagihan", scope)} label="Semua tagihan" />}>
      {bills.length === 0 ? (
        <p className="text-small text-secondary">Belum ada tagihan terjadwal.</p>
      ) : (
        <ul className="flex flex-col">
          {bills.map((b) => {
            const tone = b.overdue ? "attention" : b.daysUntilDue <= DUE_SOON_DAYS ? "due-soon" : "neutral";
            return (
              <li key={b.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-body text-primary">
                    <OwnerMark ownerId={b.ownerId} people={people} show={scope === "all"} />
                    <span className="truncate">{b.name}</span>
                  </span>
                  <span className="text-caption text-secondary">
                    {formatDateWithYear(parseDateKey(b.nextDueOn) ?? new Date())}
                    {b.amountIsEstimate ? " · perkiraan" : ""}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Amount value={b.amount} className="text-body text-primary" />
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

export function GoalsSection({ goals, scope, people }: { goals: GoalWithProgress[]; scope: Scope; people: People }) {
  return (
    <SectionCard id="target" title="Target" action={<SeeAll href={scopedHref("/target", scope)} label="Semua target" />}>
      {goals.length === 0 ? (
        <p className="text-small text-secondary">Belum ada target tabungan.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((g) => (
            <li key={g.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-body text-primary">
                  <OwnerMark ownerId={g.ownerId} people={people} show={scope === "all"} />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="tabular shrink-0 text-small text-secondary">{formatPercent(g.progressPercent)}</span>
              </div>
              <BarTrack percent={g.progressPercent} />
              <p className="text-caption text-secondary">
                <Amount value={g.progress} /> dari <Amount value={g.targetAmount} />
                {g.requiredMonthly !== null ? (
                  <>
                    {" "}
                    · setoran <Amount value={g.requiredMonthly} /> per bulan
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
