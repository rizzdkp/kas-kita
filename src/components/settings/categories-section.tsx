"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Lock, Pencil, Plus } from "lucide-react";
import type { CategoryNode } from "@/server/queries/categories";
import { archiveCategoryAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { CategoryDialog, type CategoryDialogState } from "./category-dialog";
import { categoryIcon } from "./category-icons";
import { useSave } from "./use-save";

type Kind = "expense" | "income";

const KIND_OPTIONS = [
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
] as const;

type CategoriesManagerProps = {
  /** Pohon dari listCategories({ includeArchived: true }). */
  categories: CategoryNode[];
};

export function CategoriesManager({ categories }: CategoriesManagerProps) {
  const [kind, setKind] = useState<Kind>("expense");
  const [dialog, setDialog] = useState<CategoryDialogState | null>(null);
  const toast = useToast();
  const { pending, save } = useSave();

  const roots = categories.filter((c) => c.kind === kind);
  const activeRoots = roots.filter((c) => !c.archivedAt);
  const archived = roots.flatMap((c) => [c, ...c.children.map((child) => ({ ...child, children: [] }))]).filter((c) => c.archivedAt);
  const system = categories.filter((c) => c.isSystem);

  function setArchived(category: CategoryNode, archivedNext: boolean) {
    save(() => archiveCategoryAction({ id: category.id, version: category.version, archived: archivedNext }), {
      successTitle: archivedNext ? null : `${category.name} dipulihkan`,
      onSuccess: (data) => {
        if (!archivedNext) return;
        toast.show({
          title: `${category.name} diarsipkan`,
          description: "Transaksi lama tetap memakai kategori ini.",
          action: {
            label: "Urungkan",
            onAction: () => save(() => archiveCategoryAction({ id: category.id, version: data.version, archived: false }), { successTitle: `${category.name} dipulihkan` }),
          },
        });
      },
    });
  }

  function row(category: CategoryNode, level: 0 | 1) {
    return (
      <li key={category.id} className={level === 1 ? "pl-8" : undefined}>
        <div className="flex min-h-13 items-center gap-3 border-b border-border py-1">
          <Icon icon={categoryIcon(category.icon)} className="shrink-0 text-secondary" />
          <span className={level === 0 ? "min-w-0 flex-1 truncate text-control text-primary" : "min-w-0 flex-1 truncate text-body text-primary"}>
            {category.name}
          </span>
          <IconButton icon={Pencil} label={`Ubah ${category.name}`} onClick={() => setDialog({ mode: "edit", category })} />
          <IconButton icon={Archive} label={`Arsipkan ${category.name}`} disabled={pending} onClick={() => setArchived(category, true)} />
        </div>
        {level === 0 && category.children.some((c) => !c.archivedAt) ? (
          <ul>{category.children.filter((c) => !c.archivedAt).map((child) => row({ ...child, children: [] }, 1))}</ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label="Jenis kategori" value={kind} options={KIND_OPTIONS} onValueChange={setKind} />
        <Button icon={Plus} onClick={() => setDialog({ mode: "create", kind })}>
          Tambah kategori
        </Button>
      </div>

      {activeRoots.length > 0 ? (
        <ul aria-label={kind === "expense" ? "Kategori pengeluaran" : "Kategori pemasukan"} className="border-t border-border">
          {activeRoots.map((c) => row(c, 0))}
        </ul>
      ) : (
        <p className="py-4 text-body text-secondary">
          Belum ada kategori {kind === "expense" ? "pengeluaran" : "pemasukan"}. Tambahkan dua atau tiga yang paling sering kamu pakai.
        </p>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center text-control text-secondary hover:text-primary">
            Diarsipkan ({archived.length})
          </summary>
          <ul className="border-t border-border">
            {archived.map((c) => (
              <li key={c.id} className="flex min-h-13 items-center gap-3 border-b border-border py-1">
                <Icon icon={categoryIcon(c.icon)} className="shrink-0 text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-body text-secondary">{c.name}</span>
                <Button variant="ghost" icon={ArchiveRestore} disabled={pending} onClick={() => setArchived(c, false)}>
                  Pulihkan
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {system.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-3">
          <p className="flex items-center gap-2 text-small font-medium text-primary">
            <Icon icon={Lock} size={16} className="text-secondary" />
            Kategori sistem
          </p>
          <p className="text-small text-secondary">
            {system.map((c) => c.name).join(" dan ")} dipakai app untuk transfer antar akun dan pencocokan saldo, jadi tidak bisa diubah atau diarsipkan.
          </p>
        </div>
      ) : null}

      <CategoryDialog state={dialog} onOpenChange={(open) => !open && setDialog(null)} roots={activeRoots} />
    </div>
  );
}
