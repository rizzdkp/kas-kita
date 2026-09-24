"use client";

import { formatDateWithYear, formatTime } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { TransactionRow } from "@/server/mutations/transactions";
import type { SubmitFields } from "./form-values";
import { beneficiaryLabel, KIND_LABEL } from "./labels";
import type { TransactionFormOptions } from "./types";

export interface ConflictState {
  latest: TransactionRow;
  updatedByName: string | null;
  updatedAt: Date;
  mine: SubmitFields;
}

type Comparable = Pick<TransactionRow, "kind" | "amount" | "accountId" | "toAccountId" | "categoryId" | "occurredAt" | "note" | "beneficiary">;

function categoryName(options: TransactionFormOptions, id: string | null): string {
  if (!id) return "-";
  for (const g of [...options.categories.expense, ...options.categories.income]) {
    if (g.id === id) return g.name;
    const child = g.children.find((c) => c.id === id);
    if (child) return `${g.name} › ${child.name}`;
  }
  return "Kategori lain";
}

/** Baris perbandingan yang manusiawi; nilai dibandingkan sebagai teks yang tampil. */
function describe(t: Comparable, options: TransactionFormOptions): Array<{ label: string; value: string }> {
  const account = (id: string | null) => (id ? (options.accounts.find((a) => a.id === id)?.name ?? "Akun lain") : "-");
  const ownerId = options.accounts.find((a) => a.id === t.accountId)?.ownerId ?? null;
  return [
    { label: "Jenis", value: KIND_LABEL[t.kind] },
    { label: "Nominal", value: formatRupiah(t.amount) },
    { label: "Akun", value: account(t.accountId) },
    { label: "Akun tujuan", value: account(t.toAccountId) },
    { label: "Kategori", value: categoryName(options, t.categoryId) },
    { label: "Tanggal", value: `${formatDateWithYear(t.occurredAt)}, ${formatTime(t.occurredAt)}` },
    { label: "Catatan", value: t.note?.trim() || "-" },
    { label: "Untuk", value: t.kind === "expense" ? beneficiaryLabel(t.beneficiary, ownerId, options.people) : "-" },
  ];
}

type ConflictDialogProps = {
  conflict: ConflictState | null;
  options: TransactionFormOptions;
  busy: boolean;
  onUseMine: () => void;
  onUseLatest: () => void;
  /** Ditutup tanpa memilih: form tetap terbuka dengan isian kamu. */
  onDismiss: () => void;
};

/** F-HIST-3 / UX-FLOWS 9: dua versi berdampingan, field berbeda ditandai teks, bukan hanya warna. */
export function ConflictDialog({ conflict, options, busy, onUseMine, onUseLatest, onDismiss }: ConflictDialogProps) {
  const latestRows = conflict ? describe(conflict.latest, options) : [];
  const mineRows = conflict ? describe(conflict.mine, options) : [];
  const rows = latestRows
    .map((l, i) => ({ label: l.label, latest: l.value, mine: mineRows[i]?.value ?? "-" }))
    .filter((r) => r.latest !== "-" || r.mine !== "-");
  const who = conflict?.updatedByName ?? "orang lain";
  const at = conflict ? formatTime(conflict.updatedAt) : "";

  return (
    <Dialog open={conflict !== null} onOpenChange={(open) => (!open ? onDismiss() : undefined)}>
      <DialogContent
        title={`Transaksi ini baru diubah ${who} pukul ${at}`}
        description="Pilih versi yang dipakai."
        className="w-[min(640px,calc(100vw-32px))]"
        footer={
          <>
            <Button onClick={onUseLatest} disabled={busy}>
              Pakai versi terbaru
            </Button>
            <Button variant="primary" onClick={onUseMine} loading={busy}>
              Pakai versi saya
            </Button>
          </>
        }
      >
        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="text-left text-caption text-secondary">
              <th scope="col" className="w-[28%] pb-2 pr-2 font-normal">
                <span className="sr-only">Field</span>
              </th>
              <th scope="col" className="pb-2 pr-2 font-medium">
                Versi terbaru
              </th>
              <th scope="col" className="pb-2 font-medium">
                Versi kamu
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const differs = r.latest !== r.mine;
              return (
                <tr key={r.label} className={cn("border-t border-border align-top", differs && "bg-surface-sunken")}>
                  <th scope="row" className="py-2 pl-2 pr-2 text-left font-normal text-secondary">
                    <span className="flex flex-col items-start gap-1">
                      {r.label}
                      {differs ? <Badge tone="neutral">Berbeda</Badge> : null}
                    </span>
                  </th>
                  <td className={cn("break-words py-2 pr-2 text-primary", differs && "font-medium")}>{r.latest}</td>
                  <td className={cn("break-words py-2 pr-2 text-primary", differs && "font-medium")}>{r.mine}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
