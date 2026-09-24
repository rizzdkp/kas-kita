"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { Scope } from "@/lib/scope";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SkeletonText } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  deleteTransactionAction,
  getTransactionDetailAction,
  restoreTransactionAction,
  type TransactionDetailResult,
} from "@/server/actions/transactions";
import type { TransactionListRow } from "@/server/queries/transactions";
import { TransactionDetailBody } from "./transaction-detail-body";
import { TransactionFormSheet } from "./transaction-form";
import { HistoryPanel } from "./transaction-history";
import { rowText } from "./transaction-row";
import type { People, TransactionFormOptions } from "./types";

export type DetailChange =
  | { type: "updated"; row: TransactionListRow }
  | { type: "deleted"; id: string }
  | { type: "restored"; id: string; row?: TransactionListRow };

type TransactionDetailSheetProps = {
  /** Transaksi yang dibuka; null = tertutup. */
  id: string | null;
  onClose: () => void;
  people: People;
  scope: Scope;
  formOptions?: TransactionFormOptions;
  /** Supaya daftar bisa memperbarui baris tanpa menunggu muat ulang. */
  onChange?: (change: DetailChange) => void;
  /** Konfirmasi draf; disediakan halaman karena juga dipakai tombol di baris. */
  onConfirmDraft?: (row: TransactionListRow) => Promise<boolean>;
};

export function TransactionDetailSheet({ id, onClose, people, scope, formOptions, onChange, onConfirmDraft }: TransactionDetailSheetProps) {
  const toast = useToast();
  const [data, setData] = useState<TransactionDetailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (txId: string) => {
    setError(null);
    const result = await getTransactionDetailAction(txId);
    if (result.ok) {
      setData(result.data);
      return result.data;
    }
    setError(result.error);
    return null;
  }, []);

  useEffect(() => {
    setData(null);
    if (id) void load(id);
  }, [id, load]);

  const detail = data?.detail.id === id ? data.detail : null;

  const restore = async (txId: string, row?: TransactionListRow) => {
    const result = await restoreTransactionAction({ id: txId });
    if (!result.ok) {
      toast.show({ title: result.error });
      return false;
    }
    toast.show({ title: "Transaksi dipulihkan" });
    onChange?.({ type: "restored", id: txId, row: row ? { ...row, deletedAt: null } : undefined });
    return true;
  };

  const remove = async () => {
    if (!detail) return;
    setBusy(true);
    const result = await deleteTransactionAction({ id: detail.id, version: detail.version });
    setBusy(false);
    setConfirmDelete(false);
    if (!result.ok) {
      toast.show({ title: result.error });
      if (result.code === "conflict") void load(detail.id);
      return;
    }
    const txId = detail.id;
    const snapshot: TransactionListRow = { ...detail, version: result.data.version + 1 };
    onChange?.({ type: "deleted", id: txId });
    onClose();
    toast.show({ title: "Terhapus", action: { label: "Urungkan", onAction: () => void restore(txId, snapshot) } });
  };

  const text = detail ? rowText(detail, people) : null;

  return (
    <>
      <Sheet open={id !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <SheetContent title={text?.title ?? "Detail transaksi"}>
          {detail && data ? (
            <div className="flex flex-col gap-6">
              <TransactionDetailBody detail={detail} names={data.names} people={people} />
              <div className="flex flex-wrap gap-2">
                {detail.deletedAt ? (
                  <Button
                    variant="primary"
                    icon={RotateCcw}
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      const ok = await restore(detail.id);
                      setBusy(false);
                      if (ok) onClose();
                    }}
                  >
                    Pulihkan
                  </Button>
                ) : (
                  <>
                    {detail.status === "draft" && onConfirmDraft ? (
                      <Button
                        variant="primary"
                        loading={busy}
                        onClick={async () => {
                          setBusy(true);
                          if (await onConfirmDraft(detail)) await load(detail.id);
                          setBusy(false);
                        }}
                      >
                        Konfirmasi
                      </Button>
                    ) : null}
                    <Button icon={Pencil} onClick={() => setEditing(true)}>
                      Ubah
                    </Button>
                    <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                      Hapus
                    </Button>
                  </>
                )}
              </div>
              <HistoryPanel history={data.detail.history} names={data.names} people={people} ownerId={detail.ownerId} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-body text-secondary">{error}</p>
              <Button onClick={() => id && void load(id)}>Coba lagi</Button>
            </div>
          ) : (
            <div role="status" aria-busy className="flex flex-col gap-6">
              <span className="sr-only">Memuat transaksi</span>
              <SkeletonText lines={2} />
              <SkeletonText lines={4} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {detail ? (
        <TransactionFormSheet
          open={editing}
          onOpenChange={setEditing}
          mode="edit"
          scope={scope}
          options={formOptions}
          initial={{
            id: detail.id,
            version: detail.version,
            kind: detail.kind,
            amount: detail.amount,
            accountId: detail.accountId,
            toAccountId: detail.toAccountId,
            categoryId: detail.categoryId,
            occurredAt: detail.occurredAt,
            note: detail.note,
            beneficiary: detail.beneficiary,
            status: detail.status,
            tagNames: detail.tags.map((t) => t.name),
          }}
          onSaved={async () => {
            const fresh = await load(detail.id);
            if (fresh) onChange?.({ type: "updated", row: fresh.detail });
          }}
        />
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          title="Hapus transaksi ini?"
          description="Transaksi masuk ke Baru dihapus dan bisa dipulihkan selama 30 hari."
          footer={
            <>
              <Button onClick={() => setConfirmDelete(false)} disabled={busy}>
                Batal
              </Button>
              <Button variant="danger" onClick={() => void remove()} loading={busy}>
                Hapus transaksi
              </Button>
            </>
          }
        />
      </Dialog>
    </>
  );
}
