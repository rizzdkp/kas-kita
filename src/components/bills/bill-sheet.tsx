"use client";

import { useState } from "react";
import { choiceFromOwnerId, ownerChoiceOptions, ownerIdFromChoice, type OwnerChoice, type PlanningPeople } from "@/components/budgets/owner";
import type { Option } from "@/components/budgets/options";
import { useActionRunner } from "@/components/budgets/use-action";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { formatAmountInput } from "@/lib/money";
import { createBillAction, updateBillAction } from "@/server/actions/bills";
import { buildRrule, frequencyOf, type BillFrequency } from "./rrule";
import type { AccountOption, BillItem } from "./types";

type BillSheetProps = {
  bill?: BillItem;
  people: PlanningPeople;
  initialOwner: OwnerChoice;
  payAccounts: AccountOption[];
  cardAccounts: AccountOption[];
  categories: Option[];
  today: string;
  onDone: () => void;
};

const FREQUENCIES: Array<{ value: BillFrequency; label: string }> = [
  { value: "monthly", label: "Bulanan" },
  { value: "weekly", label: "Mingguan" },
  { value: "yearly", label: "Tahunan" },
];

export function BillSheet({ bill, people, initialOwner, payAccounts, cardAccounts, categories, today, onDone }: BillSheetProps) {
  const toast = useToast();
  const action = useActionRunner();
  const [name, setName] = useState(bill?.name ?? "");
  const [isCard, setIsCard] = useState(bill ? bill.creditCardAccountId !== null : false);
  const [cardId, setCardId] = useState(bill?.creditCardAccountId ?? cardAccounts[0]?.id ?? "");
  const [amountText, setAmountText] = useState(bill && bill.storedAmount > 0n ? formatAmountInput(bill.storedAmount.toString()) : "");
  const [amount, setAmount] = useState<bigint | null>(bill && bill.storedAmount > 0n ? bill.storedAmount : null);
  const [estimate, setEstimate] = useState(bill?.amountIsEstimate ?? false);
  const [payFrom, setPayFrom] = useState(bill?.payFromAccountId ?? payAccounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "");
  const [frequency, setFrequency] = useState<BillFrequency>(bill ? frequencyOf(bill.rrule) : "monthly");
  const [dueOn, setDueOn] = useState(bill?.nextDueOn ?? today);
  const [owner, setOwner] = useState<OwnerChoice>(bill ? choiceFromOwnerId(bill.ownerId, people) : initialOwner);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return setLocalError("Isi nama tagihan");
    if (isCard && !cardId) return setLocalError("Pilih kartu kredit");
    if (!isCard && (amount === null || amount <= 0n)) return setLocalError("Isi nominal, misalnya 25rb");
    if (!isCard && !categoryId) return setLocalError("Pilih kategori tagihan");
    if (!payFrom) return setLocalError("Pilih akun pembayar");
    if (!dueOn) return setLocalError("Isi tanggal jatuh tempo");
    setLocalError(null);
    const fields = {
      name: name.trim(),
      ownerId: ownerIdFromChoice(owner, people),
      amount: isCard ? undefined : (amount ?? undefined),
      amountIsEstimate: isCard ? false : estimate,
      payFromAccountId: payFrom,
      categoryId: isCard ? null : categoryId,
      creditCardAccountId: isCard ? cardId : null,
      rrule: buildRrule(frequency, dueOn),
      nextDueOn: dueOn,
    };
    const partnerData = people.partner && fields.ownerId === people.partner.id;
    action.run(
      () => (bill ? updateBillAction({ id: bill.id, version: bill.version, fields }) : createBillAction(fields)),
      () => {
        toast.show({ title: "Tersimpan", description: partnerData ? `${people.partner?.name} akan melihat perubahan ini di riwayat.` : undefined });
        onDone();
      },
    );
  }

  const error = localError ?? action.error;
  return (
    <SheetContent title={bill ? `Ubah ${bill.name}` : "Tambah tagihan"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Nama tagihan" error={action.fieldError("name")}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Listrik" maxLength={80} />
        </Field>
        {cardAccounts.length > 0 ? (
          <Switch
            checked={isCard}
            onCheckedChange={setIsCard}
            label="Tagihan kartu kredit"
            description="Nominal dihitung otomatis dari transaksi di siklus cetak tagihan."
          />
        ) : null}
        {isCard ? (
          <Field label="Kartu kredit">
            <Select value={cardId} onValueChange={setCardId} options={cardAccounts.map((a) => ({ value: a.id, label: a.label }))} />
          </Field>
        ) : (
          <>
            <Field label="Nominal" error={action.fieldError("amount")}>
              <AmountInput
                value={amountText}
                onValueChange={(text, parsed) => {
                  setAmountText(text);
                  setAmount(parsed);
                }}
                placeholder="0"
              />
            </Field>
            <Checkbox
              checked={estimate}
              onChange={(event) => setEstimate(event.target.checked)}
              label="Nominal perkiraan"
              description="Untuk tagihan yang berubah tiap bulan, misalnya listrik. Nominalnya bisa diubah saat membayar."
            />
            <Field label="Kategori" error={action.fieldError("categoryId")}>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                options={categories.map((c) => ({ value: c.id, label: c.label }))}
                placeholder="Pilih kategori"
              />
            </Field>
          </>
        )}
        <Field label="Akun pembayar">
          <Select value={payFrom} onValueChange={setPayFrom} options={payAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Pilih akun" />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-primary">Pengulangan</span>
          <SegmentedControl label="Pengulangan" value={frequency} onValueChange={setFrequency} options={FREQUENCIES} />
        </div>
        <Field label="Jatuh tempo berikutnya" error={action.fieldError("nextDueOn")}>
          <Input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-primary">Pemilik</span>
          <SegmentedControl label="Pemilik tagihan" value={owner} onValueChange={setOwner} options={ownerChoiceOptions(people)} />
        </div>
        {error ? (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" loading={action.pending}>
            Simpan
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
