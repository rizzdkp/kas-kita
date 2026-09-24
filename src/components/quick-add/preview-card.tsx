"use client";

import { CircleAlert, X } from "lucide-react";
import type { QuickAddKind } from "@/lib/quick-add-parser";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icon";
import { IdentityDot } from "@/components/identity/identity-dot";
import type { IdentityColor } from "@/components/identity/identity-colors";
import { ChipSelect, type ChipOptionGroup } from "./chip-select";
import { AmountEditor, DateEditor, NoteEditor } from "./field-editors";
import { accountById, effectiveRecipient, missingFields, type PreviewPatch } from "./preview-model";
import type { Party, PreviewItem, QuickAddContextAccount, QuickAddContextData } from "./types";

export type PartyColors = { me: IdentityColor; partner: IdentityColor | null };

const KIND_LABEL: Record<QuickAddKind, string> = { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" };
const KIND_GROUPS: ChipOptionGroup[] = [
  { options: (Object.keys(KIND_LABEL) as QuickAddKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
];

function ownerLabel(a: QuickAddContextAccount): string {
  return a.owner === "shared" ? "Bersama" : `milik ${a.ownerName ?? ""}`;
}

function accountGroups(ctx: QuickAddContextData): ChipOptionGroup[] {
  const title: Record<Party, string> = { me: ctx.meName, partner: ctx.partnerName ?? "Partner", shared: "Bersama" };
  return (["me", "partner", "shared"] as Party[])
    .map((owner) => ({
      label: title[owner],
      options: ctx.accounts.filter((a) => a.owner === owner).map((a) => ({ value: a.id, label: a.name })),
    }))
    .filter((g) => g.options.length > 0);
}

function categoryGroups(ctx: QuickAddContextData, kind: "income" | "expense"): ChipOptionGroup[] {
  return [
    {
      options: ctx.categories
        .filter((c) => c.kind === kind)
        .map((c) => ({ value: c.id, label: c.name, indent: c.parentName !== null })),
    },
  ];
}

function AccountChip({ account, colors }: { account: QuickAddContextAccount; colors: PartyColors }) {
  const dot =
    account.owner === "shared" ? (
      colors.partner ? <IdentityDot shared={[colors.me, colors.partner]} /> : null
    ) : (
      <IdentityDot color={account.owner === "me" ? colors.me : (colors.partner ?? "slate")} />
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot}
      <span>{account.name}</span>
      <span className="text-secondary">({ownerLabel(account)})</span>
    </span>
  );
}

type PreviewCardProps = {
  item: PreviewItem;
  ctx: QuickAddContextData;
  colors: PartyColors;
  now: Date;
  index: number;
  total: number;
  onChange: (patch: PreviewPatch) => void;
  onRemove: () => void;
};

/** Kartu pratinjau satu transaksi; setiap field bisa diklik untuk diubah (F-IN-2 AC3). */
export function PreviewCard({ item, ctx, colors, now, index, total, onChange, onRemove }: PreviewCardProps) {
  const missing = new Set(missingFields(item, ctx));
  const ai = new Set(item.aiFields ?? []);
  const account = accountById(ctx, item.accountId);
  const recipient = effectiveRecipient(item, account);
  const recipientName: Record<Party, string> = { me: "Kamu", partner: ctx.partnerName ?? "Partner", shared: "Bersama" };
  const recipientGroups: ChipOptionGroup[] = [
    {
      options: (account?.owner === "shared" ? (["shared"] as Party[]) : (["me", "partner", "shared"] as Party[]))
        .filter((p) => p !== "partner" || ctx.partnerName)
        .map((p) => ({ value: p, label: recipientName[p] })),
    },
  ];
  const label = total > 1 ? `Pratinjau transaksi ${index + 1} dari ${total}` : "Pratinjau transaksi";
  const errorId = `qa-err-${item.clientId}`;

  return (
    <section
      role="group"
      aria-label={label}
      aria-describedby={item.error ? errorId : undefined}
      data-testid="quick-add-card"
      className="flex flex-col gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:px-4"
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ChipSelect
            field="Jenis"
            value={item.kind}
            onValueChange={(v) => onChange({ kind: v as QuickAddKind })}
            groups={KIND_GROUPS}
            missing={missing.has("kind")}
            missingText="Pilih jenis"
            ai={ai.has("kind")}
          />
          <AmountEditor amount={item.amount} onChange={(amount) => onChange({ amount })} ai={ai.has("amount")} />
          <ChipSelect
            field={item.kind === "transfer" ? "Dari akun" : "Akun"}
            value={item.accountId}
            onValueChange={(accountId) => onChange({ accountId })}
            groups={accountGroups(ctx)}
            missing={missing.has("account")}
            missingText="Pilih akun"
            ai={ai.has("account")}
            display={account ? <AccountChip account={account} colors={colors} /> : undefined}
          />
          {item.kind === "transfer" ? (
            <>
              <span className="text-secondary">ke</span>
              <ChipSelect
                field="Ke akun"
                value={item.toAccountId}
                onValueChange={(toAccountId) => onChange({ toAccountId })}
                groups={accountGroups(ctx)}
                missing={missing.has("toAccount")}
                missingText="Pilih akun tujuan"
                ai={ai.has("toAccount")}
                display={(() => {
                  const to = accountById(ctx, item.toAccountId);
                  return to ? <AccountChip account={to} colors={colors} /> : undefined;
                })()}
              />
            </>
          ) : item.kind !== null ? (
            <ChipSelect
              field="Kategori"
              value={item.categoryId}
              onValueChange={(categoryId) => onChange({ categoryId })}
              groups={categoryGroups(ctx, item.kind)}
              missing={missing.has("category")}
              missingText="Pilih kategori"
              ai={ai.has("category")}
            />
          ) : null}
          <DateEditor value={item.occurredAt} now={now} onChange={(occurredAt) => onChange({ occurredAt })} ai={ai.has("date")} />
          {item.kind === "expense" ? (
            <ChipSelect
              field="Untuk"
              value={recipient}
              onValueChange={(v) => onChange({ recipient: v as Party })}
              groups={recipientGroups}
              display={<span>Untuk: {recipientName[recipient]}</span>}
              disabled={account?.owner === "shared"}
              ai={ai.has("recipient") && account?.owner !== "shared"}
            />
          ) : null}
        </div>
        {total > 1 ? <IconButton icon={X} label={`Buang baris ${index + 1}`} onClick={onRemove} className="-mr-1 shrink-0" /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <NoteEditor note={item.note} onChange={(note) => onChange({ note })} ai={ai.has("note")} />
        {account?.owner === "partner" ? (
          <p className="text-small text-secondary">Dicatat atas nama {account.ownerName}, diisi oleh kamu</p>
        ) : null}
      </div>
      {item.error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-small text-error">
          <Icon icon={CircleAlert} size={16} className="mt-0.5 shrink-0" />
          <span>{item.error}</span>
        </p>
      ) : null}
    </section>
  );
}
