"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const WRONG_PASSWORD = "Password tidak cocok. Password e-statement biasanya dikirim bank lewat email atau SMS.";

type UploadPasswordDialogProps = {
  open: boolean;
  wrongPassword: boolean;
  busy: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

/** Password PDF hanya ada di state dialog ini dan request unggah; tidak disimpan di mana pun (PRD F-IN-5 AC2). */
export function UploadPasswordDialog({ open, wrongPassword, busy, onSubmit, onCancel }: UploadPasswordDialogProps) {
  const [password, setPassword] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPassword("");
          onCancel();
        }
      }}
    >
      <DialogContent
        title="PDF ini berpassword"
        description="Password hanya dipakai untuk membuka file ini sekali dan tidak disimpan."
        footer={
          <>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Batal
            </Button>
            <Button variant="primary" type="submit" form="impor-password" loading={busy} disabled={password === ""}>
              Buka PDF
            </Button>
          </>
        }
      >
        <form
          id="impor-password"
          onSubmit={(event) => {
            event.preventDefault();
            if (password !== "") onSubmit(password);
          }}
        >
          <Field label="Password e-statement" error={wrongPassword ? WRONG_PASSWORD : null}>
            <Input type="password" autoComplete="off" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
