import { formatRupiah } from "@/lib/money";
import type { Scope } from "@/lib/scope";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import type { AccountGroups, AccountWithBalance } from "@/server/queries/accounts";
import type { Metric } from "@/server/metrics/types";
import { FormulaExplainer } from "./formula-explainer";
import { scopedHref } from "./links";
import { SeeAllLink } from "./see-all-link";
import { ownerStyle, type People } from "./people";
import { SectionCard } from "./section-card";

type AccountsSectionProps = {
  accounts: AccountGroups;
  liquid: Metric<bigint>;
  liabilities: Metric<bigint>;
  netWorth: Metric<bigint>;
  scope: Scope;
  people: People;
  className?: string;
};

function Group({ title, total, rows, people, showOwner, useValue }: {
  title: string;
  total: bigint;
  rows: AccountWithBalance[];
  people: People;
  showOwner: boolean;
  useValue?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1">
        <h3 className="text-caption font-medium text-secondary">{title}</h3>
        <Amount value={total} className="text-caption font-medium text-secondary" />
      </div>
      <ul>
        {rows.map((a) => {
          const s = ownerStyle(a.ownerId, people);
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2 text-small text-primary">
                {showOwner ? <IdentityDot {...s.dot} label={`Milik ${s.name}`} /> : null}
                <span className="truncate">{a.name}</span>
              </span>
              <Amount value={useValue ? a.value : a.balance} className="shrink-0 text-small text-primary" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Saldo ringkas per akun, dikelompokkan likuid, kewajiban, aset (UX-FLOWS bagian 3.7); nilai bersih ada di baris metrik. */
export function AccountsSection({ accounts, liquid, liabilities, netWorth, scope, people, className }: AccountsSectionProps) {
  const assetTotal = accounts.asset.reduce((s, a) => s + a.value, 0n);
  return (
    <SectionCard
      id="akun"
      className={className}
      title="Akun"
      action={
        <>
          <FormulaExplainer
            trigger="icon"
            title="Akun"
            items={[
              { label: "Saldo likuid", formula: liquid.formula, inputs: liquid.inputs, result: formatRupiah(liquid.value) },
              { label: "Kewajiban", formula: liabilities.formula, inputs: liabilities.inputs, result: formatRupiah(liabilities.value) },
              { label: "Nilai bersih", formula: netWorth.formula, inputs: netWorth.inputs, result: formatRupiah(netWorth.value) },
            ]}
          />
          <SeeAllLink href={scopedHref("/akun", scope)}>Semua akun</SeeAllLink>
        </>
      }
    >
      <div className="-mt-2 flex flex-col gap-4">
        <Group title="Likuid" total={liquid.value} rows={accounts.liquid} people={people} showOwner={scope === "all"} />
        <Group title="Kewajiban" total={-liabilities.value} rows={accounts.liability} people={people} showOwner={scope === "all"} />
        <Group title="Aset" total={assetTotal} rows={accounts.asset} people={people} showOwner={scope === "all"} useValue />
      </div>
    </SectionCard>
  );
}
