"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { People } from "@/components/transactions/types";
import { personById } from "@/components/transactions/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { createAccountAction, updateAccountAction, type AccountFormInput } from "@/server/actions/accounts";
import type { ActionResult } from "@/server/actions/result";
import type { AccountType } from "@/server/db/schema";
import type { AccountWithBalance } from "@/server/queries/accounts";
import { AccountFormFields, type InstitutionOption } from "./account-form-fields";
import { initialFormState, mapServerErrors, toAccountInput, type AccountFormState, type FormErrors, type OwnerChoice } from "./account-form-model";

type AccountFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithBalance | null;
  presetType?: AccountType;
  presetOwner?: OwnerChoice;
  people: People;
  institutions: InstitutionOption[];
  today: string;
};

export function AccountFormSheet(props: AccountFormSheetProps) {
  const { open, onOpenChange, account } = props;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SheetContent title={account ? "Ubah akun" : "Tambah akun"}>
          <AccountForm key={account?.id ?? "baru"} {...props} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function versionOf(latest: unknown): number | null {
  if (latest && typeof latest === "object" && "version" in latest && typeof latest.version === "number") return latest.version;
  return null;
}

function ownerTarget(people: People, ownerId: string | null): string {
  return personById(people, ownerId)?.name ?? "Bersama";
}

function AccountForm({ account, presetType, presetOwner, people, institutions, today, onOpenChange }: AccountFormSheetProps) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<AccountFormState>(() => initialFormState(people, { account, presetType, presetOwner, today }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ message: string; version: number } | null>(null);
  const [pendingOwner, setPendingOwner] = useState<AccountFormInput | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<AccountFormState>) => {
    setState((s) => ({ ...s, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch) as Array<keyof AccountFormState>) delete next[key];
      return next;
    });
  };

  function handleResult(result: ActionResult<unknown>, input: AccountFormInput) {
    if (result.ok) {
      const partner = input.ownerId !== null && input.ownerId !== people.me.id ? personById(people, input.ownerId) : null;
      toast.show({ title: partner ? `Tersimpan. ${partner.name} akan melihat perubahan ini di riwayat.` : "Tersimpan" });
      onOpenChange(false);
      return;
    }
    const latestVersion = result.conflict ? versionOf(result.conflict.latest) : null;
    if (latestVersion !== null) {
      setConflict({ message: result.error, version: latestVersion });
      return;
    }
    const fieldErrors = mapServerErrors(result.fieldErrors);
    setErrors(fieldErrors);
    setFormError(Object.keys(fieldErrors).length > 0 ? null : result.error);
  }

  function save(input: AccountFormInput, version?: number) {
    setFormError(null);
    setConflict(null);
    startTransition(async () => {
      const result = account
        ? await updateAccountAction({ id: account.id, version: version ?? account.version, patch: input })
        : await createAccountAction(input);
      handleResult(result, input);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = toAccountInput(state, people);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    // pindah pemilik ikut memindahkan semua transaksinya, jadi minta konfirmasi dulu (F-ACC-1 AC2)
    if (account && parsed.input.ownerId !== account.ownerId && account.hasTransactions) {
      setPendingOwner(parsed.input);
      return;
    }
    save(parsed.input);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <AccountFormFields state={state} errors={errors} people={people} institutions={institutions} onChange={update} />

      {formError ? (
        <p role="alert" className="text-small text-error">
          {formError}
        </p>
      ) : null}

      {conflict ? (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-border bg-surface-sunken p-4">
          <p className="text-small text-primary">{conflict.message}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const parsed = toAccountInput(state, people);
                if (parsed.ok) save(parsed.input, conflict.version);
              }}
            >
              Pakai versi saya
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                router.refresh();
              }}
            >
              Pakai versi terbaru
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Batal
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {account ? "Simpan" : "Tambah akun"}
        </Button>
      </div>

      <Dialog open={pendingOwner !== null} onOpenChange={(o) => (o ? null : setPendingOwner(null))}>
        {pendingOwner && account ? (
          <DialogContent
            title={`Pindahkan ${account.name} ke ${ownerTarget(people, pendingOwner.ownerId)}?`}
            description={`Semua transaksi di akun ini ikut pindah pemilik ke ${ownerTarget(people, pendingOwner.ownerId)}. Perubahan tercatat di riwayat akun.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setPendingOwner(null)}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const input = pendingOwner;
                    setPendingOwner(null);
                    save(input);
                  }}
                >
                  Pindahkan
                </Button>
              </>
            }
          />
        ) : null}
      </Dialog>
    </form>
  );
}
