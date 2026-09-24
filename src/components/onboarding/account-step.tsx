"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AccountType } from "@/server/db/schema";
import type { ActionError } from "@/server/actions/result";
import { createOnboardingAccountAction } from "@/server/actions/settings";
import { Amount } from "@/components/money/amount";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { firstFieldError, formLevelError, useSave } from "@/components/settings/use-save";
import { StepActions } from "./step-actions";
import type { OnboardingPerson, StepProps } from "./types";

const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-wallet" },
  { value: "cash", label: "Tunai" },
  { value: "credit_card", label: "Kartu kredit" },
  { value: "paylater", label: "PayLater" },
  { value: "loan", label: "Pinjaman" },
  { value: "investment", label: "Investasi" },
  { value: "other_asset", label: "Aset lain" },
];
const LIABILITY: ReadonlySet<AccountType> = new Set(["credit_card", "paylater", "loan"]);
const BALANCE_ERROR = "Isi saldo hari ini, misalnya 1,5jt";

type Owner = "me" | "partner" | "shared";
type Added = { id: string; name: string; balance: bigint };

function isAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPE_OPTIONS.some((o) => o.value === value);
}

export function AccountStep({ partner, existingCount, onNext, onSkip, isLast, finishing }: StepProps & { partner: OnboardingPerson | null; existingCount: number }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [owner, setOwner] = useState<Owner>("me");
  const [balanceText, setBalanceText] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [added, setAdded] = useState<Added[]>([]);
  const [error, setError] = useState<ActionError | null>(null);
  const { pending, save } = useSave();
  const ownerOptions = [
    { value: "me", label: "Saya" },
    ...(partner ? [{ value: "partner", label: partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ] as ReadonlyArray<{ value: Owner; label: string }>;
  const generalError = formLevelError(error, ["name", "balance", "type", "owner"]);
  const hasAccount = added.length + existingCount > 0;

  return (
    <div className="flex flex-col gap-6">
      {existingCount > 0 ? (
        <p className="text-body text-secondary">Sudah ada {existingCount} akun. Tambahkan lagi kalau ada yang belum tercatat.</p>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (balance === null) {
            setError({ ok: false, code: "validation", error: BALANCE_ERROR, fieldErrors: { balance: [BALANCE_ERROR] } });
            return;
          }
          const signed = LIABILITY.has(type) && balance > 0n ? -balance : balance;
          save(() => createOnboardingAccountAction({ name, type, owner, balance }), {
            successTitle: `${name.trim()} ditambahkan`,
            onError: setError,
            onSuccess: (data) => {
              setAdded((list) => [...list, { id: data.id, name: data.name, balance: signed }]);
              setName("");
              setBalanceText("");
              setBalance(null);
            },
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama akun" error={firstFieldError(error, "name")}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="BCA gaji" maxLength={60} autoComplete="off" />
          </Field>
          <Field label="Jenis">
            <Select value={type} onValueChange={(v) => isAccountType(v) && setType(v)} options={ACCOUNT_TYPE_OPTIONS} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-small font-medium text-primary">
            Pemilik
          </span>
          <SegmentedControl label="Pemilik" value={owner} options={ownerOptions} onValueChange={setOwner} className="w-full sm:w-auto sm:self-start" />
        </div>
        <Field
          label="Saldo hari ini"
          error={firstFieldError(error, "balance")}
          description={LIABILITY.has(type) ? "Tulis sisa utangnya. App mencatatnya sebagai kewajiban." : "Lihat di aplikasi bank atau dompet. Bisa dicocokkan lagi nanti."}
        >
          <AmountInput
            value={balanceText}
            onValueChange={(text, amount) => {
              setBalanceText(text);
              setBalance(amount);
            }}
            className="sm:max-w-64"
          />
        </Field>
        {generalError ? <p className="text-small text-error">{generalError}</p> : null}
        <Button type="submit" icon={Plus} loading={pending} className="self-start">
          Tambah akun
        </Button>
      </form>
      {added.length > 0 ? (
        <ul aria-label="Akun yang baru ditambahkan" className="border-t border-border">
          {added.map((account) => (
            <li key={account.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border text-body text-primary">
              <span className="truncate">{account.name}</span>
              <Amount value={account.balance} />
            </li>
          ))}
        </ul>
      ) : null}
      <StepActions onSkip={onSkip} onNext={onNext} isLast={isLast} busy={finishing} nextDisabled={!hasAccount || pending} />
    </div>
  );
}
