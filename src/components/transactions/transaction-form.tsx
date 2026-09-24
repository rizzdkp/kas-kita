"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Scope } from "@/lib/scope";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SkeletonText } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { createTransactionAction, getTransactionFormOptionsAction, updateTransactionAction } from "@/server/actions/transactions";
import type { TransactionRow } from "@/server/mutations/transactions";
import { ConflictDialog, type ConflictState } from "./conflict-dialog";
import { categoryExists, initialValues, mapFieldErrors, toSubmitFields, type FormValues, type SubmitFields } from "./form-values";
import { TransactionFormFields } from "./transaction-form-fields";
import type { TransactionFormInitial, TransactionFormOptions } from "./types";

export type TransactionFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Wajib untuk edit (id, version, dan nilai sekarang); untuk tambah boleh prefill sebagian. */
  initial?: TransactionFormInitial;
  scope: Scope;
  /** Kalau tidak diberikan, sheet memuatnya sendiri lewat server action saat dibuka. */
  options?: TransactionFormOptions;
  onSaved?: (row: TransactionRow) => void;
};

/** Form F-IN-1 dalam Sheet, untuk tambah dan ubah transaksi dari halaman mana pun. */
export function TransactionFormSheet({ open, onOpenChange, mode, initial, scope, options, onSaved }: TransactionFormSheetProps) {
  const [loaded, setLoaded] = useState<TransactionFormOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const effective = options ?? loaded;

  const load = useCallback(async () => {
    setLoadError(null);
    const result = await getTransactionFormOptionsAction(scope);
    if (result.ok) setLoaded(result.data);
    else setLoadError(result.error);
  }, [scope]);

  useEffect(() => {
    if (open && !options) void load();
  }, [open, options, load]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={mode === "create" ? "Tambah transaksi" : "Ubah transaksi"}>
        {effective ? (
          <TransactionForm
            mode={mode}
            initial={initial}
            scope={scope}
            options={effective}
            onCancel={() => onOpenChange(false)}
            onSaved={(row) => {
              onOpenChange(false);
              onSaved?.(row);
            }}
          />
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body text-secondary">{loadError}</p>
            <Button onClick={() => void load()}>Coba lagi</Button>
          </div>
        ) : (
          <div role="status" aria-busy className="flex flex-col gap-6">
            <span className="sr-only">Memuat form</span>
            <SkeletonText lines={3} />
            <SkeletonText lines={3} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

type TransactionFormProps = {
  mode: "create" | "edit";
  initial?: TransactionFormInitial;
  scope: Scope;
  options: TransactionFormOptions;
  onCancel: () => void;
  onSaved: (row: TransactionRow) => void;
};

/** Hanya field yang benar-benar diubah dikirim, supaya riwayat dan notifikasi partner tidak berisik. */
function changedFields(next: SubmitFields, values: FormValues, start: FormValues, base: SubmitFields | null): Partial<SubmitFields> {
  if (!base) return next;
  const patch: Partial<SubmitFields> = {};
  if (next.kind !== base.kind) patch.kind = next.kind;
  if (next.amount !== base.amount) patch.amount = next.amount;
  if (next.accountId !== base.accountId) patch.accountId = next.accountId;
  if (next.toAccountId !== base.toAccountId) patch.toAccountId = next.toAccountId;
  if (next.categoryId !== base.categoryId) patch.categoryId = next.categoryId;
  if (values.occurredLocal !== start.occurredLocal) patch.occurredAt = next.occurredAt;
  if (next.note !== base.note) patch.note = next.note;
  if (next.beneficiary !== base.beneficiary) patch.beneficiary = next.beneficiary;
  if ([...next.tagNames].sort().join("\u0000") !== [...base.tagNames].sort().join("\u0000")) patch.tagNames = next.tagNames;
  return patch;
}

export function TransactionForm({ mode, initial, scope, options, onCancel, onSaved }: TransactionFormProps) {
  const toast = useToast();
  const start = useMemo(() => initialValues(options, scope, initial), [options, scope, initial]);
  const base = useMemo(() => (mode === "edit" ? toSubmitFields(start, options, initial?.beneficiary).fields : null), [mode, start, options, initial]);
  const [values, setValues] = useState<FormValues>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [clientId] = useState(() => crypto.randomUUID());

  const onChange = (patch: Partial<FormValues>) => {
    setValues((v) => {
      const next = { ...v, ...patch };
      if (patch.kind && !categoryExists(options, patch.kind, next.categoryId)) {
        next.categoryId = patch.kind === "expense" && categoryExists(options, "expense", options.defaults.categoryId) ? (options.defaults.categoryId ?? "") : "";
      }
      return next;
    });
    setErrors((e) => {
      const keys = Object.keys(patch).map((k) => (k === "amountText" ? "amount" : k === "occurredLocal" ? "occurredAt" : k === "tagsText" ? "tags" : k));
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  };

  const partnerTouched = (fields: Partial<SubmitFields>) => {
    const partnerId = options.people.partner?.id;
    if (!partnerId) return false;
    const ids = [initial?.accountId, initial?.toAccountId, fields.accountId, fields.toAccountId];
    return options.accounts.some((a) => a.ownerId === partnerId && ids.includes(a.id));
  };

  const submit = async (versionOverride?: number) => {
    const { fields, errors: clientErrors } = toSubmitFields(values, options, initial?.beneficiary);
    if (!fields) {
      setErrors(clientErrors);
      return;
    }
    setBusy(true);
    setFormError(null);
    const patch = changedFields(fields, values, start, base);
    const result =
      mode === "create"
        ? await createTransactionAction({ ...fields, clientId })
        : await updateTransactionAction({ id: initial?.id ?? "", version: versionOverride ?? initial?.version ?? 1, patch });
    setBusy(false);
    if (result.ok) {
      setConflict(null);
      const partnerName = options.people.partner?.name;
      toast.show({
        title: mode === "edit" && partnerName && partnerTouched(fields) ? `Tersimpan. ${partnerName} akan melihat perubahan ini di riwayat.` : "Tersimpan",
      });
      onSaved(result.data);
      return;
    }
    if (result.code === "conflict" && result.conflict) {
      const latest = result.conflict.latest as TransactionRow;
      // "versi kamu" = versi terbaru + field yang kamu ubah, persis yang tersimpan kalau memilih versi saya
      setConflict({
        latest,
        updatedByName: result.conflict.updatedByName,
        updatedAt: result.conflict.updatedAt,
        mine: { ...latest, tagNames: fields.tagNames, ...patch },
      });
      return;
    }
    setConflict(null);
    // pesan saldo dari server sudah menyebut saldo saat ini (PRD 5.4), tampil apa adanya di field nominal
    if (result.code === "insufficient_balance") {
      setErrors({ amount: result.error });
      return;
    }
    const fieldErrors = mapFieldErrors(result.fieldErrors);
    if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
    else setFormError(result.error);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit();
      }}
      className="flex flex-col gap-6"
    >
      <TransactionFormFields
        values={values}
        onChange={onChange}
        errors={errors}
        options={options}
        mode={mode}
        keepAccountIds={[initial?.accountId, initial?.toAccountId]}
      />
      {formError ? (
        <p role="alert" className="text-small text-error">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Simpan
        </Button>
      </div>
      <ConflictDialog
        conflict={conflict}
        options={options}
        busy={busy}
        onDismiss={() => setConflict(null)}
        onUseMine={() => conflict && void submit(conflict.latest.version)}
        onUseLatest={() => {
          const latest = conflict?.latest;
          setConflict(null);
          if (latest) onSaved(latest);
        }}
      />
    </form>
  );
}

