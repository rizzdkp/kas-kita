"use client";

import { useMemo, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { AmountInput } from "@/components/money/amount-input";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { GroupedSelect } from "@/components/transactions/grouped-select";
import type { BeneficiaryChoice } from "@/components/transactions/labels";
import { accountOptionGroups, categoryOptions } from "@/components/transactions/option-groups";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { saveReceiptAction } from "@/server/actions/receipts";
import { blockingReason, initialFormState, ownerChoice, parsedLines, parsedTotal, toSavePayload, type ReceiptDraftData, type ReceiptFormState } from "./receipt-form-model";
import { ReceiptItems } from "./receipt-items";
import { mismatchMessage, sumLines } from "./receipt-math";
import { SaveModeChoice } from "./save-mode-choice";

type ReceiptFormProps = {
  attachmentId: string;
  draft: ReceiptDraftData;
  aiError: string | null;
  options: TransactionFormOptions;
  defaultAccountId: string;
  onCancel: () => void;
  onSaved: (transactionId: string) => void;
};

function Notice({ children, tone }: { children: React.ReactNode; tone: "attention" | "error" }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-border bg-surface-sunken p-3 text-small text-primary">
      <Icon icon={CircleAlert} size={16} className={tone === "attention" ? "mt-0.5 shrink-0 text-attention" : "mt-0.5 shrink-0 text-error"} />
      <span>{children}</span>
    </div>
  );
}

/** Field hasil baca struk (UX-FLOWS 5 langkah 4-6); semua bisa diubah, tidak ada simpan otomatis. */
export function ReceiptForm({ attachmentId, draft, aiError, options, defaultAccountId, onCancel, onSaved }: ReceiptFormProps) {
  const [state, setState] = useState<ReceiptFormState>(() => initialFormState(draft, options, defaultAccountId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId] = useState(() => crypto.randomUUID());
  const touchedBeneficiary = useRef(false);

  const catOptions = useMemo(() => categoryOptions(options.categories.expense), [options.categories.expense]);
  const catNames = useMemo(() => new Map(catOptions.map((o) => [o.value, o.selectedLabel ?? o.label])), [catOptions]);
  const { people } = options;
  const account = options.accounts.find((a) => a.id === state.accountId);
  const forPartner = people.partner !== null && account?.ownerId === people.partner.id;

  const change = (patch: Partial<ReceiptFormState>) => {
    setError(null);
    setState((s) => {
      const next = { ...s, ...patch };
      // untuk siapa mengikuti pemilik akun sampai diubah sendiri, sama seperti form transaksi
      if (patch.accountId && !touchedBeneficiary.current) next.beneficiary = ownerChoice(options, patch.accountId);
      return next;
    });
  };

  const lines = parsedLines(state);
  const banner = mismatchMessage(sumLines(lines), parsedTotal(state), lines.length);
  const reason = blockingReason(state);
  const beneficiaryOptions: Array<{ value: BeneficiaryChoice; label: string }> = [
    { value: "me", label: "Kamu" },
    ...(people.partner ? [{ value: "partner" as const, label: people.partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ];

  const save = async () => {
    const payload = toSavePayload(state, options, attachmentId, clientId);
    if (!payload) return;
    setSaving(true);
    const result = await saveReceiptAction(payload).catch(() => null);
    setSaving(false);
    if (!result) setError("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
    else if (!result.ok) setError(result.error);
    else onSaved(result.data.id);
  };

  return (
    <Card className="flex flex-col gap-5">
      {banner ? <Notice tone="attention">{banner}</Notice> : null}
      {aiError ? <Notice tone="error">{aiError}</Notice> : null}
      {forPartner && people.partner ? (
        <p className="flex items-center gap-2 text-small text-secondary">
          <IdentityDot color={people.partner.color} />
          Dicatat atas nama {people.partner.name}, diisi oleh kamu
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Total struk" required className="sm:col-span-1">
          <AmountInput value={state.totalText} onValueChange={(totalText) => change({ totalText })} placeholder="Misalnya 192rb" />
        </Field>
        <Field label="Tanggal dan waktu" required>
          <Input type="datetime-local" value={state.occurredLocal} onChange={(e) => change({ occurredLocal: e.target.value })} />
        </Field>
        <Field label="Catatan" description="Nama toko dari struk" className="sm:col-span-2">
          <Input value={state.note} onChange={(e) => change({ note: e.target.value })} placeholder="Misalnya Indomaret" maxLength={500} />
        </Field>
        <Field label="Akun" required>
          <GroupedSelect
            value={state.accountId}
            onValueChange={(accountId) => change({ accountId })}
            groups={accountOptionGroups(options.accounts, people, [state.accountId])}
            placeholder="Pilih akun"
          />
        </Field>
        {account && account.ownerId !== null ? (
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-small font-medium text-primary">
              Untuk siapa
            </span>
            <SegmentedControl
              label="Untuk siapa"
              value={state.beneficiary}
              options={beneficiaryOptions}
              onValueChange={(beneficiary) => {
                touchedBeneficiary.current = true;
                change({ beneficiary });
              }}
              className="w-full"
            />
          </div>
        ) : null}
      </div>

      <SaveModeChoice value={state.mode} onValueChange={(mode) => change({ mode })} />

      {state.mode === "single" ? (
        <Field label="Kategori" required>
          <GroupedSelect
            value={state.categoryId}
            onValueChange={(categoryId) => change({ categoryId })}
            groups={[{ options: catOptions }]}
            placeholder="Pilih kategori"
          />
        </Field>
      ) : null}

      <ReceiptItems state={state} onChange={change} categoryOptions={catOptions} categoryName={(id) => catNames.get(id) ?? "Kategori lain"} />

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
        {error ? (
          <p role="alert" className="text-small text-error sm:mr-auto">
            {error}
          </p>
        ) : reason ? (
          <p className="text-small text-secondary sm:mr-auto">{reason}</p>
        ) : null}
        <div className="flex gap-2 self-end">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={reason !== null}>
            Simpan
          </Button>
        </div>
      </div>
    </Card>
  );
}
