"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { dateKey, formatRelativeDay, formatTime, jakartaDate, toJakarta } from "@/lib/dates";
import { formatAmountInput, formatRupiah, parseAmount } from "@/lib/money";
import { PenLine } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { AmountInput } from "@/components/money/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FieldChip } from "./field-chip";

type EditorShellProps = {
  field: string;
  missing?: boolean;
  missingText?: string;
  chip: ReactNode;
  /** Dipanggil saat popover ditutup lewat Enter atau tombol Selesai. */
  onCommit: () => void;
  onOpen: () => void;
  children: ReactNode;
};

function EditorShell({ field, missing, missingText, chip, onCommit, onOpen, children }: EditorShellProps) {
  const [open, setOpen] = useState(false);
  const commit = () => {
    onCommit();
    setOpen(false);
  };
  // Enter di dalam editor hanya menutup editor, bukan menyimpan kartu
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    commit();
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) onOpen();
        else onCommit();
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <FieldChip field={field} missing={missing} missingText={missingText}>
          {chip}
        </FieldChip>
      </PopoverTrigger>
      <PopoverContent align="start" onKeyDown={onKeyDown} className="flex flex-col gap-3">
        {children}
        <Button variant="secondary" onClick={commit} className="self-end">
          Selesai
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function AmountEditor({ amount, onChange }: { amount: bigint | null; onChange: (v: bigint | null) => void }) {
  const [text, setText] = useState("");
  const parsed = parseAmount(text);
  const invalid = text.trim() !== "" && (parsed === null || parsed <= 0n);
  return (
    <EditorShell
      field="Nominal"
      missing={amount === null}
      missingText="Isi nominal"
      chip={<span className="tabular text-card">{amount !== null ? formatRupiah(amount) : null}</span>}
      onOpen={() => setText(amount !== null ? formatAmountInput(amount.toString()) : "")}
      onCommit={() => {
        if (parsed !== null && parsed > 0n) onChange(parsed);
        else if (text.trim() === "") onChange(null);
      }}
    >
      <Field label="Nominal" error={invalid ? "Isi nominal, misalnya 25rb" : null}>
        <AmountInput autoFocus value={text} onValueChange={(t) => setText(t)} />
      </Field>
    </EditorShell>
  );
}

function timeValue(d: Date): string {
  return formatTime(d).replace(".", ":");
}

export function DateEditor({ value, now, onChange }: { value: Date; now: Date; onChange: (v: Date) => void }) {
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  return (
    <EditorShell
      field="Tanggal"
      chip={
        <span className="tabular">
          {formatRelativeDay(value, now)} {formatTime(value)}
        </span>
      }
      onOpen={() => {
        setDay(dateKey(value));
        setTime(timeValue(value));
      }}
      onCommit={() => {
        const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
        const t = /^(\d{2}):(\d{2})$/.exec(time);
        if (!d) return;
        const z = toJakarta(value);
        const [hh, mm] = t ? [Number(t[1]), Number(t[2])] : [z.getHours(), z.getMinutes()];
        onChange(new Date(jakartaDate(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hh, mm).getTime()));
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="Tanggal">
          <Input type="date" autoFocus value={day} max={dateKey(now)} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label="Jam">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
    </EditorShell>
  );
}

export function NoteEditor({ note, onChange }: { note: string | null; onChange: (v: string | null) => void }) {
  const [text, setText] = useState("");
  return (
    <EditorShell
      field="Catatan"
      chip={
        <>
          <Icon icon={PenLine} size={16} className="shrink-0 text-secondary" />
          {note ? <span className="max-w-64 truncate">{note}</span> : <span className="text-secondary">Tambah catatan</span>}
        </>
      }
      onOpen={() => setText(note ?? "")}
      onCommit={() => onChange(text.trim() ? text.trim() : null)}
    >
      <Field label="Catatan">
        <Input autoFocus value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
      </Field>
    </EditorShell>
  );
}
