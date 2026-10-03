"use client";

import { useState } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { formatRangeLabel, periodRange, type PeriodMode } from "@/lib/dates";
import type { ActionError } from "@/server/actions/result";
import { updateProfileAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { selectWithArrows } from "@/components/ui/radio-arrows";
import { parsePaydayText, PaydayInput } from "./payday-input";
import { firstFieldError, formLevelError, useSave } from "./use-save";

const MODES: ReadonlyArray<{ value: PeriodMode; label: string; description: string }> = [
  { value: "calendar", label: "Bulan kalender", description: "Tanggal 1 sampai akhir bulan." },
  { value: "payday_cycle", label: "Siklus gajian", description: "Dari tanggal gajian sampai sehari sebelum gajian berikutnya." },
];

function isMode(value: string): value is PeriodMode {
  return value === "calendar" || value === "payday_cycle";
}

export function PaydayForm({ paydayDay, periodMode }: { paydayDay: number; periodMode: PeriodMode }) {
  const [dayText, setDayText] = useState(String(paydayDay));
  const [mode, setMode] = useState<PeriodMode>(periodMode);
  const [error, setError] = useState<ActionError | null>(null);
  const { pending, save } = useSave();
  const day = parsePaydayText(dayText);
  const generalError = formLevelError(error, ["paydayDay"]);
  const dirty = day !== paydayDay || mode !== periodMode;
  const preview = day ? formatRangeLabel(periodRange(mode, day)) : null;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (day === null) {
          setError({ ok: false, code: "validation", error: "Isi tanggal gajian 1 sampai 31", fieldErrors: { paydayDay: ["Isi tanggal gajian 1 sampai 31"] } });
          return;
        }
        save(() => updateProfileAction({ paydayDay: day, periodMode: mode }), { onError: setError });
      }}
    >
      <PaydayInput value={dayText} onChange={setDayText} error={firstFieldError(error, "paydayDay")} />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-small font-medium text-primary">Awal periode</legend>
        <RadioGroup.Root
          value={mode}
          onValueChange={(next) => {
            if (isMode(next)) setMode(next);
          }}
          onKeyDownCapture={(event) => selectWithArrows(event, MODES.map((m) => m.value), mode, setMode)}
          aria-label="Awal periode"
          className="grid gap-2 sm:grid-cols-2"
        >
          {MODES.map((option) => (
            <RadioGroup.Item
              key={option.value}
              value={option.value}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border border-border bg-surface px-3 py-3 text-left",
                "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:border-border-strong",
                "data-[state=checked]:border-accent data-[state=checked]:shadow-[inset_0_0_0_1px_var(--accent)]",
              )}
            >
              <span className="text-control text-primary">{option.label}</span>
              <span className="text-small text-secondary">{option.description}</span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        <p className="text-small text-secondary" aria-live="polite">
          {preview ? (
            <>
              Periode sekarang: <span className="tabular text-primary">{preview}</span>
            </>
          ) : (
            "Isi tanggal gajian untuk melihat periode sekarang."
          )}
        </p>
      </fieldset>
      {generalError ? <p className="text-small text-error">{generalError}</p> : null}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={pending} disabled={!dirty}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
