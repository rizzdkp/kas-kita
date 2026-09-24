"use client";

import { useState } from "react";
import type { ActionError } from "@/server/actions/result";
import { updateProfileAction } from "@/server/actions/settings";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IdentityColorPicker } from "@/components/settings/identity-color-picker";
import { parsePaydayText, PaydayInput } from "@/components/settings/payday-input";
import { firstFieldError, formLevelError, useSave } from "@/components/settings/use-save";
import { StepActions } from "./step-actions";
import type { OnboardingPerson, OnboardingProfile, StepProps } from "./types";

const PAYDAY_ERROR = "Isi tanggal gajian 1 sampai 31";

export function ProfileStep({ profile, partner, onNext, onSkip, isLast, finishing }: StepProps & { profile: OnboardingProfile; partner: OnboardingPerson | null }) {
  const [name, setName] = useState(profile.displayName);
  const [color, setColor] = useState(profile.identityColor);
  const [dayText, setDayText] = useState(String(profile.paydayDay));
  const [error, setError] = useState<ActionError | null>(null);
  const { pending, save } = useSave();
  const generalError = formLevelError(error, ["displayName", "identityColor", "paydayDay"]);

  return (
    <form
      id="langkah-profil"
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const paydayDay = parsePaydayText(dayText);
        if (paydayDay === null) {
          setError({ ok: false, code: "validation", error: PAYDAY_ERROR, fieldErrors: { paydayDay: [PAYDAY_ERROR] } });
          return;
        }
        save(() => updateProfileAction({ displayName: name, identityColor: color, paydayDay }), {
          successTitle: null,
          onSuccess: onNext,
          onError: setError,
        });
      }}
    >
      <Field
        label="Nama tampilan"
        error={firstFieldError(error, "displayName")}
        description={partner ? `Nama yang dilihat ${partner.name} di cakupan dan riwayat.` : "Nama yang tampil di cakupan dan riwayat."}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="nickname" className="sm:max-w-80" />
      </Field>
      <IdentityColorPicker value={color} onChange={setColor} partner={partner} error={firstFieldError(error, "identityColor")} />
      <PaydayInput value={dayText} onChange={setDayText} error={firstFieldError(error, "paydayDay")} />
      {generalError ? <p className="text-small text-error">{generalError}</p> : null}
      <StepActions form="langkah-profil" onSkip={onSkip} isLast={isLast} busy={pending || finishing} />
    </form>
  );
}
