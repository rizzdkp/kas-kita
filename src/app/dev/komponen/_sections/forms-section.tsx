"use client";

import { useState } from "react";
import { parseAmount } from "@/lib/money";
import { AmountInput } from "@/components/money/amount-input";
import { Amount } from "@/components/money/amount";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "./section";

const ACCOUNTS = [
  { value: "bca", label: "BCA (contoh)" },
  { value: "jago", label: "Bank Jago (contoh)" },
  { value: "gopay", label: "GoPay (contoh)" },
  { value: "tunai", label: "Tunai (contoh)", disabled: true },
];

export function FormsSection() {
  const [amountText, setAmountText] = useState("");
  const [account, setAccount] = useState<string>("");
  const [kind, setKind] = useState<"expense" | "income" | "transfer">("expense");
  const [shared, setShared] = useState(true);
  const parsed = parseAmount(amountText);

  return (
    <Section id="form" title="Form">
      <div className="grid gap-6 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 sm:p-(--space-card)">
        <Field label="Nominal" description="Singkatan rb, jt, dan k diterima.">
          <AmountInput
            value={amountText}
            onValueChange={(text) => setAmountText(text)}
            placeholder="25.000"
          />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-small font-medium text-primary">Hasil parse</p>
          <p className="text-body text-secondary">
            {parsed === null ? "Belum valid" : <Amount value={parsed} className="text-primary" />}
          </p>
        </div>
        <Field label="Nominal" error="Isi nominal, misalnya 25rb">
          <AmountInput defaultValue="" />
        </Field>
        <Field label="Akun" description="Akun default mengikuti cakupan aktif.">
          <Select value={account} onValueChange={setAccount} options={ACCOUNTS} placeholder="Pilih akun" />
        </Field>
        <Field label="Catatan">
          <Input placeholder="makan siang" />
        </Field>
        <Field label="Catatan" description="Contoh field nonaktif.">
          <Input disabled defaultValue="Tidak bisa diubah" />
        </Field>
        <Field label="Keterangan panjang" className="sm:col-span-2">
          <Textarea placeholder="Tulis keterangan" />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-small font-medium text-primary">Jenis</p>
          <SegmentedControl
            label="Jenis transaksi"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "expense", label: "Pengeluaran" },
              { value: "income", label: "Pemasukan" },
              { value: "transfer", label: "Transfer" },
            ]}
          />
        </div>
        <div className="flex flex-col">
          <Checkbox label="Masuk anggaran" description="Contoh checkbox dengan keterangan." defaultChecked />
          <Checkbox label="Nonaktif" disabled />
          <Switch label="Akun Bersama" checked={shared} onCheckedChange={setShared} />
        </div>
      </div>
    </Section>
  );
}
