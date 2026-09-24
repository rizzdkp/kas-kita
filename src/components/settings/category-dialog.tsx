"use client";

import { useState } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import type { CategoryNode } from "@/server/queries/categories";
import type { ActionError } from "@/server/actions/result";
import { createCategoryAction, updateCategoryAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { selectWithArrows } from "@/components/ui/radio-arrows";
import { Select } from "@/components/ui/select";
import { CATEGORY_ICONS } from "./category-icons";
import { firstFieldError, formLevelError, useSave } from "./use-save";

const NO_PARENT = "utama";
const ICON_KEYS = CATEGORY_ICONS.map((entry) => entry.key);

export type CategoryDialogState =
  | { mode: "create"; kind: "income" | "expense" }
  | { mode: "edit"; category: CategoryNode };

type CategoryDialogProps = {
  state: CategoryDialogState | null;
  onOpenChange: (open: boolean) => void;
  /** Induk yang mungkin: kategori utama aktif dengan jenis yang sama. */
  roots: CategoryNode[];
};

export function CategoryDialog({ state, onOpenChange, roots }: CategoryDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      {state ? (
        <CategoryForm key={state.mode === "edit" ? state.category.id : `baru-${state.kind}`} state={state} roots={roots} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function CategoryForm({ state, roots, onDone }: { state: CategoryDialogState; roots: CategoryNode[]; onDone: () => void }) {
  const editing = state.mode === "edit" ? state.category : null;
  const kind = editing ? editing.kind : state.mode === "create" ? state.kind : "expense";
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "circle");
  const [parent, setParent] = useState(editing?.parentId ?? NO_PARENT);
  const [error, setError] = useState<ActionError | null>(null);
  const { pending, save } = useSave();
  const generalError = formLevelError(error, ["name", "parentId"]);
  // kategori yang punya subkategori tetap di tingkat utama (maksimal dua tingkat)
  const hasChildren = (editing?.children.length ?? 0) > 0;
  const parentOptions = [
    { value: NO_PARENT, label: "Tidak ada, jadikan kategori utama" },
    ...roots.filter((r) => r.kind === kind && r.id !== editing?.id).map((r) => ({ value: r.id, label: r.name })),
  ];
  const parentId = parent === NO_PARENT ? null : parent;

  function submit() {
    setError(null);
    const options = { onSuccess: onDone, onError: setError };
    if (editing) {
      save(() => updateCategoryAction({ id: editing.id, version: editing.version, patch: { name, icon, parentId } }), options);
    } else if (state.mode === "create") {
      save(() => createCategoryAction({ name, icon, parentId, kind: state.kind }), options);
    }
  }

  return (
    <DialogContent
      title={editing ? "Ubah kategori" : kind === "income" ? "Tambah kategori pemasukan" : "Tambah kategori pengeluaran"}
      className="w-[min(520px,calc(100vw-32px))]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Batal</Button>
          </DialogClose>
          <Button type="submit" form="kategori-form" loading={pending}>
            Simpan
          </Button>
        </>
      }
    >
      <form
        id="kategori-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Nama" error={firstFieldError(error, "name")}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="off" />
        </Field>
        <Field
          label="Induk"
          error={firstFieldError(error, "parentId")}
          description={hasChildren ? "Kategori ini punya subkategori, jadi tetap jadi kategori utama." : "Kategori maksimal dua tingkat."}
        >
          <Select value={parent} onValueChange={setParent} options={parentOptions} disabled={hasChildren} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-small font-medium text-primary">Ikon</legend>
          <RadioGroup.Root
            value={icon}
            onValueChange={setIcon}
            onKeyDownCapture={(event) => selectWithArrows(event, ICON_KEYS, icon, setIcon)}
            aria-label="Ikon"
            className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1"
          >
            {CATEGORY_ICONS.map((entry) => (
              <RadioGroup.Item
                key={entry.key}
                value={entry.key}
                aria-label={entry.label}
                title={entry.label}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-md border border-transparent text-secondary",
                  "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken hover:text-primary",
                  "data-[state=checked]:border-accent data-[state=checked]:bg-surface data-[state=checked]:text-primary",
                )}
              >
                <Icon icon={entry.icon} />
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
        {generalError ? <p className="text-small text-error">{generalError}</p> : null}
      </form>
    </DialogContent>
  );
}
