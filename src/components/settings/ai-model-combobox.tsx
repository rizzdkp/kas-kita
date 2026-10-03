"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

type ModelComboboxProps = {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  /** null sebelum daftar diambil; kolom tetap bisa diisi ID manual. */
  models: readonly string[] | null;
  placeholder?: string;
};

/** Combobox ARIA 1.2: ketik untuk mencari di daftar model, atau biarkan teksnya sebagai ID model manual (F-AI-1 AC1). */
export function ModelCombobox({ label, description, value, onChange, models, placeholder }: ModelComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.trim().toLowerCase();
  // baru mulai menyaring setelah pengguna mengetik, supaya model terpilih tidak menyembunyikan pilihan lain
  const options = models ? (typed && query ? models.filter((m) => m.toLowerCase().includes(query)) : models) : [];
  const expanded = open && models !== null && models.length > 0;
  const optionId = (i: number) => `${listId}-opsi-${i}`;

  function choose(model: string) {
    onChange(model);
    setOpen(false);
    setTyped(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!models?.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i < 0 ? (step > 0 ? 0 : options.length - 1) : (i + step + options.length) % options.length));
    } else if (event.key === "Enter" && expanded && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  const noMatch = expanded && options.length === 0;

  return (
    <Field label={label} description={description}>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 && active < options.length ? optionId(active) : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          className={cn(models?.length ? "pr-11" : undefined)}
          onChange={(event) => {
            onChange(event.target.value);
            setTyped(true);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
        {models?.length ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-secondary">
            <Icon icon={ChevronDown} size={16} />
          </span>
        ) : null}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!expanded || options.length === 0}
        className="max-h-60 overflow-y-auto rounded-md border border-border bg-surface py-1"
      >
        {options.map((model, i) => {
          const selected = model === value;
          return (
            <li
              key={model}
              id={optionId(i)}
              role="option"
              aria-selected={selected}
              // mousedown dicegah supaya input tidak kehilangan fokus sebelum pilihan tercatat
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(model)}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-body text-primary sm:min-h-10",
                i === active && "bg-surface-sunken",
              )}
            >
              <span className="min-w-0 break-all">{model}</span>
              {selected ? <Icon icon={Check} size={16} className="shrink-0 text-accent" /> : null}
            </li>
          );
        })}
      </ul>
      {noMatch ? <p className="text-small text-secondary">Tidak ada di daftar. ID yang kamu ketik tetap dipakai.</p> : null}
    </Field>
  );
}
