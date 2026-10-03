"use client";

import { useState } from "react";
import type { Option } from "@/components/budgets/options";
import { choiceFromOwnerId, ownerChoiceOptions, ownerIdFromChoice, type OwnerChoice, type PlanningPeople } from "@/components/budgets/owner";
import { useActionRunner } from "@/components/budgets/use-action";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatAmountInput } from "@/lib/money";
import { createGoalAction, updateGoalAction } from "@/server/actions/goals";
import type { GoalItem } from "./types";

// Radix Select tidak menerima nilai kosong, jadi "tanpa akun" diberi nilai sendiri
const NO_ACCOUNT = "none";

type GoalSheetProps = {
  goal?: GoalItem;
  people: PlanningPeople;
  initialOwner: OwnerChoice;
  accounts: Option[];
  today: string;
  onDone: () => void;
};

export function GoalSheet({ goal, people, initialOwner, accounts, today, onDone }: GoalSheetProps) {
  const toast = useToast();
  const action = useActionRunner();
  const [name, setName] = useState(goal?.name ?? "");
  const [amountText, setAmountText] = useState(goal ? formatAmountInput(goal.targetAmount.toString()) : "");
  const [amount, setAmount] = useState<bigint | null>(goal?.targetAmount ?? null);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [accountId, setAccountId] = useState(goal?.linkedAccountId ?? NO_ACCOUNT);
  const [owner, setOwner] = useState<OwnerChoice>(goal ? choiceFromOwnerId(goal.ownerId, people) : initialOwner);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return setLocalError("Isi nama target");
    if (amount === null || amount <= 0n) return setLocalError("Isi nominal, misalnya 25rb");
    if (deadline && deadline <= today) return setLocalError("Tenggat harus setelah hari ini");
    setLocalError(null);
    const fields = {
      name: name.trim(),
      ownerId: ownerIdFromChoice(owner, people),
      targetAmount: amount,
      deadline: deadline || null,
      linkedAccountId: accountId === NO_ACCOUNT ? null : accountId,
    };
    const partnerData = people.partner && fields.ownerId === people.partner.id;
    action.run(
      () => (goal ? updateGoalAction({ id: goal.id, version: goal.version, fields }) : createGoalAction(fields)),
      () => {
        toast.show({ title: "Tersimpan", description: partnerData ? `${people.partner?.name} akan melihat perubahan ini di riwayat.` : undefined });
        onDone();
      },
    );
  }

  const error = localError ?? action.error;
  return (
    <SheetContent title={goal ? `Ubah ${goal.name}` : "Tambah target"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Nama target" error={action.fieldError("name")}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dana darurat" maxLength={80} />
        </Field>
        <Field label="Nominal target" error={action.fieldError("targetAmount")}>
          <AmountInput
            value={amountText}
            onValueChange={(text, parsed) => {
              setAmountText(text);
              setAmount(parsed);
            }}
            placeholder="0"
          />
        </Field>
        <Field label="Tenggat" description="Opsional. Dengan tenggat, Kas Kita menghitung setoran bulanan yang dibutuhkan.">
          <Input type="date" value={deadline} min={today} onChange={(event) => setDeadline(event.target.value)} />
        </Field>
        <Field
          label="Akun penampung"
          description="Kalau ada, progres diambil dari saldo akun ini. Tanpa akun, progres dari setoran yang kamu catat."
        >
          <Select
            value={accountId}
            onValueChange={setAccountId}
            options={[{ value: NO_ACCOUNT, label: "Tanpa akun, catat setoran manual" }, ...accounts.map((a) => ({ value: a.id, label: a.label }))]}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-primary">Pemilik</span>
          <SegmentedControl label="Pemilik target" value={owner} onValueChange={setOwner} options={ownerChoiceOptions(people)} />
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
