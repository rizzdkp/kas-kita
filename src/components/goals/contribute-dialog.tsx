"use client";

import { useState } from "react";
import { useActionRunner } from "@/components/budgets/use-action";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/money";
import { contributeToGoalAction } from "@/server/actions/goals";
import type { GoalItem } from "./types";

export function ContributeDialog({ goal, today, onDone }: { goal: GoalItem; today: string; onDone: () => void }) {
  const toast = useToast();
  const action = useActionRunner();
  const [amountText, setAmountText] = useState("");
  const [amount, setAmount] = useState<bigint | null>(null);
  const [on, setOn] = useState(today);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    if (amount === null || amount <= 0n) return setLocalError("Isi nominal, misalnya 25rb");
    setLocalError(null);
    action.run(
      () => contributeToGoalAction({ goalId: goal.id, amount, contributedOn: on }),
      (data) => {
        toast.show(
          data.achieved
            ? { title: `Target ${goal.name} tercapai`, description: "Target ini pindah ke bagian Tercapai." }
            : { title: "Tersimpan", description: `Setoran ${formatRupiah(amount)} ke ${goal.name}.` },
        );
        onDone();
      },
    );
  }

  const error = localError ?? action.error;
  return (
    <DialogContent title={`Setor ke ${goal.name}`} description={`Sisa ${formatRupiah(goal.remaining)} lagi.`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Nominal setoran" error={action.fieldError("amount")}>
          <AmountInput
            value={amountText}
            autoFocus
            onValueChange={(text, parsed) => {
              setAmountText(text);
              setAmount(parsed);
            }}
            placeholder="500.000"
          />
        </Field>
        <Field label="Tanggal">
          <Input type="date" value={on} max={today} onChange={(event) => setOn(event.target.value)} />
        </Field>
        {error ? (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button onClick={onDone}>Batal</Button>
          <Button type="submit" variant="primary" loading={action.pending}>
            Simpan setoran
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
