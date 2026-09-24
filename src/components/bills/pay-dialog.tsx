"use client";

import { useState } from "react";
import { shortDateFromKey } from "@/components/budgets/list-helpers";
import { useActionRunner } from "@/components/budgets/use-action";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatAmountInput, formatRupiah } from "@/lib/money";
import { payBillAction } from "@/server/actions/bills";
import type { AccountOption, BillItem } from "./types";

type PayDialogProps = {
  bill: BillItem;
  accounts: AccountOption[];
  today: string;
  onDone: () => void;
};

/** Konfirmasi "Bayar": nominal bisa diubah untuk perkiraan dan kartu kredit, lalu transaksi dibuat (F-BILL-1 AC1). */
export function PayDialog({ bill, accounts, today, onDone }: PayDialogProps) {
  const toast = useToast();
  const action = useActionRunner();
  const isCard = bill.creditCardAccountId !== null;
  const editable = bill.amountIsEstimate || isCard;
  const [amountText, setAmountText] = useState(bill.amount > 0n ? formatAmountInput(bill.amount.toString()) : "");
  const [amount, setAmount] = useState<bigint | null>(bill.amount > 0n ? bill.amount : null);
  const [accountId, setAccountId] = useState(bill.payFromAccountId);
  const [paidOn, setPaidOn] = useState(today);
  const [localError, setLocalError] = useState<string | null>(null);
  const accountOptions = accounts.some((a) => a.id === bill.payFromAccountId)
    ? accounts
    : [{ id: bill.payFromAccountId, label: bill.payFromAccountName }, ...accounts];

  function submit() {
    if (amount === null || amount <= 0n) return setLocalError("Isi nominal, misalnya 25rb");
    if (!paidOn) return setLocalError("Isi tanggal bayar");
    setLocalError(null);
    const accountName = accountOptions.find((a) => a.id === accountId)?.label ?? "";
    action.run(
      () => payBillAction({ id: bill.id, version: bill.version, amount, payFromAccountId: accountId, paidOn }),
      (data) => {
        toast.show({
          title: `${bill.name} dibayar`,
          description: `${formatRupiah(amount)} dari ${accountName}. Jatuh tempo berikutnya ${shortDateFromKey(data.nextDueOn)}.`,
        });
        onDone();
      },
    );
  }

  const error = localError ?? action.error;
  return (
    <DialogContent
      title={`Bayar ${bill.name}`}
      description={
        isCard
          ? `Dicatat sebagai transfer ke ${bill.creditCardAccountName ?? "kartu kredit"}, bukan pengeluaran.`
          : `Dicatat sebagai pengeluaran${bill.categoryName ? ` ${bill.categoryName}` : ""}.`
      }
    >
      <form
        id="form-bayar"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {editable ? (
          <Field
            label="Nominal"
            description={isCard ? bill.cycleLabel : "Nominal ini perkiraan. Sesuaikan dengan tagihan yang datang."}
            error={action.fieldError("amount")}
          >
            <AmountInput
              value={amountText}
              onValueChange={(text, parsed) => {
                setAmountText(text);
                setAmount(parsed);
              }}
            />
          </Field>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-small font-medium text-primary">Nominal</span>
            <span className="tabular text-section text-primary">{formatRupiah(bill.amount)}</span>
          </div>
        )}
        <Field label="Dibayar dari">
          <Select value={accountId} onValueChange={setAccountId} options={accountOptions.map((a) => ({ value: a.id, label: a.label }))} />
        </Field>
        <Field label="Tanggal bayar">
          <Input type="date" value={paidOn} max={today} onChange={(event) => setPaidOn(event.target.value)} />
        </Field>
        {error ? (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button onClick={onDone}>Batal</Button>
          <Button type="submit" variant="primary" loading={action.pending}>
            Bayar {amount !== null && amount > 0n ? formatRupiah(amount) : ""}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
