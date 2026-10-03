"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionError } from "@/server/actions/result";
import { changePasswordAction } from "@/server/auth/password-actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { firstFieldError, formLevelError, useSave } from "./use-save";

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;
const MIN_LENGTH = 12;

/** Ganti password F-AUTH-1; perangkat lain dikeluarkan setelah berhasil. */
export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<ActionError | null>(null);
  const { pending, save } = useSave();
  const generalError = formLevelError(error, FIELDS);
  const ready = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (newPassword.length < MIN_LENGTH) {
          const message = `Password minimal ${MIN_LENGTH} karakter.`;
          setError({ ok: false, code: "validation", error: message, fieldErrors: { newPassword: [message] } });
          return;
        }
        if (newPassword !== confirmPassword) {
          const message = "Kedua password belum sama.";
          setError({ ok: false, code: "validation", error: message, fieldErrors: { confirmPassword: [message] } });
          return;
        }
        save(() => changePasswordAction({ currentPassword, newPassword, confirmPassword }), {
          successTitle: "Password diganti. Perangkat lain sudah dikeluarkan.",
          onSuccess: () => {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            router.refresh();
          },
          onError: setError,
        });
      }}
    >
      <Field label="Password sekarang" error={firstFieldError(error, "currentPassword")}>
        <Input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="sm:max-w-sm"
        />
      </Field>
      <Field label="Password baru" description={`Minimal ${MIN_LENGTH} karakter.`} error={firstFieldError(error, "newPassword")}>
        <Input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="sm:max-w-sm"
        />
      </Field>
      <Field label="Ulangi password baru" error={firstFieldError(error, "confirmPassword")}>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="sm:max-w-sm"
        />
      </Field>
      {generalError ? (
        <p role="alert" className="text-small text-error">
          {generalError}
        </p>
      ) : null}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={pending} disabled={!ready}>
          Ganti password
        </Button>
      </div>
    </form>
  );
}
