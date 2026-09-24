"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteAccountAction, setAccountArchivedAction } from "@/server/actions/accounts";
import type { AccountWithBalance } from "@/server/queries/accounts";

type Props = {
  account: AccountWithBalance | null;
  onOpenChange: (open: boolean) => void;
};

/** Hapus hanya untuk akun tanpa transaksi; kalau server menolak, tawarkan arsip (F-ACC-1 AC1). */
export function DeleteAccountDialog({ account, onOpenChange }: Props) {
  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      {account ? <DeleteBody key={account.id} account={account} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function DeleteBody({ account, onDone }: { account: AccountWithBalance; onDone: () => void }) {
  const toast = useToast();
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await deleteAccountAction({ id: account.id, version: account.version });
      if (result.ok) {
        toast.show({ title: "Akun dihapus" });
        onDone();
      } else if (result.code === "account_has_transactions") setBlocked(result.error);
      else setError(result.error);
    });

  const archive = () =>
    startTransition(async () => {
      const result = await setAccountArchivedAction({ id: account.id, version: account.version, archived: true });
      if (result.ok) {
        toast.show({ title: "Diarsipkan" });
        onDone();
      } else setError(result.error);
    });

  const alreadyArchived = account.archivedAt !== null;

  return (
    <DialogContent
      title={blocked ? `${account.name} tidak bisa dihapus` : `Hapus ${account.name}?`}
      description={blocked ?? "Akun tanpa transaksi dihapus permanen dari daftar. Akun yang sudah punya transaksi hanya bisa diarsipkan."}
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>
            Batal
          </Button>
          {blocked ? (
            alreadyArchived ? null : (
              <Button variant="primary" loading={pending} onClick={archive}>
                Arsipkan
              </Button>
            )
          ) : (
            <Button variant="danger" loading={pending} onClick={remove}>
              Hapus akun
            </Button>
          )}
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      ) : null}
    </DialogContent>
  );
}
