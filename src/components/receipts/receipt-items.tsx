"use client";

import { Plus, X } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import { AmountInput } from "@/components/money/amount-input";
import { Amount } from "@/components/money/amount";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { GroupedSelect, type GroupedOption } from "@/components/transactions/grouped-select";
import { amountText, newItemKey, parsedLines, parsedTotal, type ItemState, type ReceiptFormState } from "./receipt-form-model";
import { groupLinesByCategory, sumLines } from "./receipt-math";

type ReceiptItemsProps = {
  state: ReceiptFormState;
  onChange: (patch: Partial<ReceiptFormState>) => void;
  categoryOptions: GroupedOption[];
  categoryName: (id: string) => string;
};

/** Daftar item struk; kategori per item hanya relevan saat dipecah per kategori. */
export function ReceiptItems({ state, onChange, categoryOptions, categoryName }: ReceiptItemsProps) {
  const split = state.mode === "split";
  const update = (key: string, patch: Partial<ItemState>) =>
    onChange({ items: state.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  const remove = (key: string) => onChange({ items: state.items.filter((i) => i.key !== key) });
  const add = (item: Partial<ItemState> = {}) =>
    onChange({ items: [...state.items, { key: newItemKey(), name: "", amountText: "", categoryId: "", ...item }] });

  const lines = parsedLines(state);
  const itemsTotal = sumLines(lines);
  const total = parsedTotal(state);
  const diff = total !== null ? total - itemsTotal : null;
  const groups = groupLinesByCategory(lines).filter((g) => g.categoryId);

  return (
    <section aria-labelledby="struk-item" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="struk-item" className="text-card text-primary">
          Item struk
        </h2>
        {state.items.length > 0 ? (
          <p className="text-small text-secondary">
            Jumlah item <Amount value={itemsTotal} className="text-primary" />
          </p>
        ) : null}
      </div>

      {state.items.length === 0 ? (
        <p className="text-small text-secondary">Belum ada item terbaca. Tambahkan item kalau ingin memecah per kategori.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {state.items.map((item, index) => (
            <li
              key={item.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_136px_auto] sm:items-start"
            >
              <Field label={`Nama item ${index + 1}`} hideLabel className="col-span-1">
                <Input value={item.name} onChange={(e) => update(item.key, { name: e.target.value })} placeholder="Nama item" />
              </Field>
              <IconButton icon={X} label={`Buang item ${index + 1}`} onClick={() => remove(item.key)} className="sm:order-last" />
              <Field label={`Nominal item ${index + 1}`} hideLabel className="col-span-1 sm:col-span-1">
                <AmountInput
                  value={item.amountText}
                  onValueChange={(amountText) => update(item.key, { amountText })}
                  placeholder="Nominal"
                  className="text-right tabular-nums"
                />
              </Field>
              {split ? (
                <Field label={`Kategori item ${index + 1}`} hideLabel className="col-span-2 sm:col-span-3 sm:col-start-1">
                  <GroupedSelect
                    value={item.categoryId}
                    onValueChange={(categoryId) => update(item.key, { categoryId })}
                    groups={[{ options: categoryOptions }]}
                    placeholder="Pilih kategori"
                  />
                </Field>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" icon={Plus} onClick={() => add()}>
          Tambah item
        </Button>
      </div>

      {split && groups.length > 0 ? (
        <div className="flex flex-col gap-2 pt-1">
          <h3 className="text-small font-medium text-primary">Rincian per kategori</h3>
          <dl className="flex flex-col gap-1 text-small">
            {groups.map((g) => (
              <div key={g.categoryId} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 truncate text-secondary">{categoryName(g.categoryId!)}</dt>
                <dd className="tabular-nums text-primary">{formatRupiah(g.amount)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {split && diff !== null && diff !== 0n && state.items.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-3">
          <p className="text-small text-primary">
            Jumlah item selisih {formatRupiah(diff < 0n ? -diff : diff)} dari total. Transaksi yang dipecah harus pas dengan totalnya.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => add({ name: diff > 0n ? "Selisih struk" : "Potongan", amountText: amountText(diff), categoryId: groups[0]?.categoryId ?? "" })}
            >
              Tambah item selisih
            </Button>
            {itemsTotal > 0n ? (
              <Button variant="ghost" onClick={() => onChange({ totalText: amountText(itemsTotal) })}>
                Pakai jumlah item sebagai total
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
