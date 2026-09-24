"use client";

import { useState } from "react";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatAmountInput } from "@/lib/money";
import { saveBudgetAction } from "@/server/actions/budgets";
import { choiceFromOwnerId, ownerChoiceOptions, ownerIdFromChoice, ownerName, type OwnerChoice, type PlanningPeople } from "./owner";
import { useActionRunner } from "./use-action";

export type CategoryOption = { id: string; label: string };

export type EditableBudget = {
  id: string;
  ownerId: string | null;
  categoryId: string;
  categoryName: string;
  amount: bigint;
  isMandatory: boolean;
  version: number;
};

type BudgetSheetProps = {
  month: string;
  people: PlanningPeople;
  categories: CategoryOption[];
  /** Kunci "ownerId|shared:categoryId" yang sudah punya anggaran bulan ini. */
  taken: string[];
  initialOwner: OwnerChoice;
  budget?: EditableBudget;
  onDone: () => void;
  onDelete?: () => void;
};

export function budgetKey(ownerId: string | null, categoryId: string): string {
  return `${ownerId ?? "shared"}:${categoryId}`;
}

/** Sheet tambah/ubah anggaran; pemilik dan kategori terkunci saat mengubah karena itu kunci unik anggaran. */
export function BudgetSheet({ month, people, categories, taken, initialOwner, budget, onDone, onDelete }: BudgetSheetProps) {
  const toast = useToast();
  const action = useActionRunner();
  const [owner, setOwner] = useState<OwnerChoice>(budget ? choiceFromOwnerId(budget.ownerId, people) : initialOwner);
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? "");
  const [amountText, setAmountText] = useState(budget ? formatAmountInput(budget.amount.toString()) : "");
  const [amount, setAmount] = useState<bigint | null>(budget?.amount ?? null);
  const [mandatory, setMandatory] = useState<"wajib" | "fleksibel">(budget?.isMandatory ? "wajib" : "fleksibel");
  const [localError, setLocalError] = useState<string | null>(null);

  const ownerId = ownerIdFromChoice(owner, people);
  const takenSet = new Set(taken);
  const options = categories.map((c) => ({ value: c.id, label: c.label, disabled: !budget && takenSet.has(budgetKey(ownerId, c.id)) }));

  function submit() {
    if (!categoryId) return setLocalError("Pilih kategori pengeluaran");
    if (amount === null || amount <= 0n) return setLocalError("Isi nominal, misalnya 25rb");
    setLocalError(null);
    action.run(
      () =>
        saveBudgetAction({
          scopeOwner: ownerId ? `user:${ownerId}` : "shared",
          categoryId,
          month: `${month}-01`,
          amount,
          isMandatory: mandatory === "wajib",
          version: budget?.version,
        }),
      () => {
        const partnerData = people.partner && ownerId === people.partner.id;
        toast.show({
          title: "Tersimpan",
          description: partnerData ? `${people.partner?.name} akan melihat perubahan ini di riwayat.` : undefined,
        });
        onDone();
      },
    );
  }

  const error = localError ?? action.error;

  return (
    <SheetContent
      title={budget ? `Ubah anggaran ${budget.categoryName}` : "Tambah anggaran"}
      description={budget ? `Milik ${ownerName(budget.ownerId, people)}` : undefined}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {budget ? null : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-small font-medium text-primary">
                Pemilik anggaran
              </span>
              <SegmentedControl label="Pemilik anggaran" value={owner} onValueChange={setOwner} options={ownerChoiceOptions(people)} />
            </div>
            <Field label="Kategori pengeluaran" error={action.fieldError("categoryId")}>
              <Select value={categoryId} onValueChange={setCategoryId} options={options} placeholder="Pilih kategori" />
            </Field>
          </>
        )}
        <Field label="Nominal per bulan" error={action.fieldError("amount")}>
          <AmountInput
            value={amountText}
            onValueChange={(text, parsed) => {
              setAmountText(text);
              setAmount(parsed);
            }}
            placeholder="0"
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-primary">Jenis</span>
          <SegmentedControl
            label="Jenis anggaran"
            value={mandatory}
            onValueChange={setMandatory}
            options={[
              { value: "fleksibel", label: "Fleksibel" },
              { value: "wajib", label: "Wajib" },
            ]}
          />
          <p className="text-small text-secondary">Sisa anggaran wajib mengurangi Aman dibelanjakan. Anggaran fleksibel tidak.</p>
        </div>
        {error ? (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {onDelete ? (
            <Button variant="danger" onClick={onDelete}>
              Hapus anggaran
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" variant="primary" loading={action.pending}>
            Simpan
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
