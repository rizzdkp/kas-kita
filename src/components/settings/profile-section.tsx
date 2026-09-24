"use client";

import { useState } from "react";
import Link from "next/link";
import type { IdentityColor } from "@/server/db/schema/users";
import type { ActionError } from "@/server/actions/result";
import { updateProfileAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IdentityColorPicker } from "./identity-color-picker";
import { firstFieldError, formLevelError, useSave } from "./use-save";

type ProfileSectionProps = {
  displayName: string;
  identityColor: IdentityColor;
  partner: { name: string; color: IdentityColor } | null;
};

export function ProfileForm({ displayName, identityColor, partner }: ProfileSectionProps) {
  const [name, setName] = useState(displayName);
  const [color, setColor] = useState(identityColor);
  const [error, setError] = useState<ActionError | null>(null);
  const { pending, save } = useSave();
  const generalError = formLevelError(error, ["displayName", "identityColor"]);
  const dirty = name.trim() !== displayName || color !== identityColor;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        save(() => updateProfileAction({ displayName: name, identityColor: color }), {
          onSuccess: (data) => setName(data.displayName),
          onError: setError,
        });
      }}
    >
      <Field
        label="Nama tampilan"
        error={firstFieldError(error, "displayName")}
        description={partner ? `Nama ini yang dilihat ${partner.name} di cakupan dan riwayat.` : "Nama ini tampil di cakupan dan riwayat."}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="nickname" className="sm:max-w-80" />
      </Field>
      <IdentityColorPicker value={color} onChange={setColor} partner={partner} error={firstFieldError(error, "identityColor")} />
      {generalError ? <p className="text-small text-error">{generalError}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Link href="/mulai?ulang=1" className="rounded-xs text-control text-accent underline-offset-4 hover:underline">
          Ulangi pengenalan
        </Link>
        <Button type="submit" loading={pending} disabled={!dirty}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
