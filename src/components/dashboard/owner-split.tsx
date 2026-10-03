import { BarTrack } from "@/components/charts/bar-track";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import { ownerOrder, ownerStyle, type People } from "./people";

export interface OwnerValue {
  ownerId: string | null;
  amount: bigint;
}

/** Kontribusi per orang di Gabungan: batang bersegmen warna identitas dan legenda bernilai. */
export function OwnerSplit({ people, values }: { people: People; values: OwnerValue[] }) {
  const rows = values.filter((v) => v.amount > 0n).sort((a, b) => ownerOrder(a.ownerId, people) - ownerOrder(b.ownerId, people));
  const total = rows.reduce((s, r) => s + r.amount, 0n);
  if (total === 0n) return null;
  return (
    <div className="flex flex-col gap-2 pt-1">
      <BarTrack
        percent={100}
        segments={rows.map((r) => ({
          key: ownerStyle(r.ownerId, people).key,
          percent: Number((r.amount * 1000n) / total) / 10,
          background: ownerStyle(r.ownerId, people).background,
        }))}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-secondary">
        {rows.map((r) => {
          const s = ownerStyle(r.ownerId, people);
          return (
            <li key={s.key} className="inline-flex items-center gap-2">
              <IdentityDot {...s.dot} />
              {s.name} <Amount value={r.amount} format="compact" className="text-primary" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Legenda warna pemilik untuk batang bersegmen. */
export function OwnerLegend({ people, ownerIds }: { people: People; ownerIds: Array<string | null> }) {
  const unique = [...new Map(ownerIds.map((id) => [ownerStyle(id, people).key, id])).values()].sort(
    (a, b) => ownerOrder(a, people) - ownerOrder(b, people),
  );
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-secondary" aria-label="Warna pemilik">
      {unique.map((id) => {
        const s = ownerStyle(id, people);
        return (
          <li key={s.key} className="inline-flex items-center gap-2">
            <IdentityDot {...s.dot} />
            {s.name}
          </li>
        );
      })}
    </ul>
  );
}
