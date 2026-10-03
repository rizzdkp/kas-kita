"use client";

import { ChevronRight, Pencil, Trash2, TrendingUp } from "lucide-react";
import { formatDateWithYear, parseDateKey } from "@/lib/dates";
import { formatPercent } from "@/lib/money";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Amount } from "@/components/money/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ownerDot, personById } from "@/components/transactions/labels";
import type { People } from "@/components/transactions/types";
import type { InvestmentSummary, ValuationRow } from "@/server/queries/investments";
import { ValuationChart } from "./valuation-chart";

type Props = {
  item: InvestmentSummary;
  people: People;
  onUpdate: () => void;
  onEdit: (v: ValuationRow) => void;
  onDelete: (v: ValuationRow) => void;
};

export function dayText(key: string): string {
  const d = parseDateKey(key);
  return d ? formatDateWithYear(d) : key;
}

export function signedPercent(p: number): string {
  return p > 0 ? `+${formatPercent(p)}` : formatPercent(p);
}

function Stat({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-secondary">{label}</dt>
      <dd className="flex flex-col gap-1">
        {children}
        {note ? <span className="text-caption text-secondary">{note}</span> : null}
      </dd>
    </div>
  );
}

export function InvestmentCard({ item, people, onUpdate, onEdit, onDelete }: Props) {
  const { account } = item;
  const dot = ownerDot(people, account.ownerId);
  const meta = [account.institutionName, personById(people, account.ownerId)?.name ?? "Bersama"].filter(Boolean).join(" · ");
  const history = [...item.valuations].reverse();
  const headingId = `investasi-${account.id}`;
  const chartSummary =
    item.valuations.length >= 2
      ? `Nilai pasar ${account.name} dari ${dayText(item.valuations[0]!.valuedOn)} sampai ${dayText(item.valuations.at(-1)!.valuedOn)}. Rincian ada di riwayat nilai.`
      : "";

  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IdentityDot color={dot.color} shared={dot.shared} label={dot.label} />
          <div className="flex min-w-0 flex-col">
            <h2 id={headingId} className="truncate text-card text-primary">
              {account.name}
            </h2>
            <span className="truncate text-small text-secondary">{meta}</span>
          </div>
        </div>
        <Button icon={TrendingUp} onClick={onUpdate}>
          Perbarui nilai
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Stat label="Nilai pasar" note={item.valuedOn ? `per ${dayText(item.valuedOn)}` : "Belum pernah diperbarui"}>
          {item.marketValue !== null ? <Amount value={item.marketValue} size="large" /> : <span className="text-large text-secondary">−</span>}
        </Stat>
        <Stat label="Modal disetor" note="Saldo awal + transfer masuk − transfer keluar">
          <Amount value={item.contributed} className="text-card" />
        </Stat>
        <Stat label="Imbal hasil" note={item.returnPercent !== null ? `${signedPercent(item.returnPercent)} dari modal` : "Muncul setelah nilai pasar diisi"}>
          {item.returnAmount !== null ? <Amount value={item.returnAmount} sign="always" className="text-card" /> : <span className="text-card text-secondary">−</span>}
        </Stat>
      </dl>

      {item.valuations.length >= 2 ? (
        <ValuationChart valuations={item.valuations} summary={chartSummary} />
      ) : (
        <p className="text-small text-secondary">Grafik nilai muncul setelah dua kali pembaruan nilai.</p>
      )}

      {history.length > 0 ? (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-small text-secondary hover:text-primary sm:min-h-8 [&::-webkit-details-marker]:hidden">
            <Icon icon={ChevronRight} size={16} className="transition-transform duration-(--dur-fast) group-open:rotate-90" />
            Riwayat nilai ({history.length})
          </summary>
          <div className="mt-2 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-small">
              <caption className="sr-only">Riwayat nilai pasar {account.name}, terbaru di atas</caption>
              <thead>
                <tr className="text-secondary">
                  <th scope="col" className="border-b border-border px-3 py-2 text-left font-medium">
                    Tanggal
                  </th>
                  <th scope="col" className="border-b border-border px-3 py-2 text-right font-medium">
                    Nilai pasar
                  </th>
                  <th scope="col" className="hidden border-b border-border px-3 py-2 text-left font-medium sm:table-cell">
                    Catatan
                  </th>
                  <th scope="col" className="border-b border-border px-3 py-2">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-1 text-primary">{dayText(v.valuedOn)}</td>
                    <td className="px-3 py-1 text-right">
                      <Amount value={v.marketValue} />
                    </td>
                    <td className="hidden max-w-[32ch] truncate px-3 py-1 text-secondary sm:table-cell">{v.note ?? ""}</td>
                    <td className="px-1 py-1">
                      <div className="flex justify-end">
                        <IconButton icon={Pencil} label={`Ubah nilai ${dayText(v.valuedOn)}`} onClick={() => onEdit(v)} />
                        <IconButton icon={Trash2} label={`Hapus nilai ${dayText(v.valuedOn)}`} onClick={() => onDelete(v)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
