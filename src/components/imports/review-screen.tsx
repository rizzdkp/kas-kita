"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, TriangleAlert } from "lucide-react";
import { formatDateWithYear, formatShortDate, parseDateKey } from "@/lib/dates";
import type { BeneficiaryChoice } from "@/components/transactions/labels";
import type { TransactionFormOptions } from "@/components/transactions/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { commitImportAction, discardImportAction } from "@/server/actions/import-review";
import type { ImportReview } from "@/server/queries/import-review";
import { ReviewDuplicateItem } from "./review-duplicate-item";
import { ReviewExactList } from "./review-exact-list";
import { commitToastTitle, countChoices, initialChoices, missingCategoryMessage, toCommitInput, type Choices, type RowAction } from "./review-model";
import { ReviewNewRow } from "./review-new-row";
import { buildCategoryOptionGroups } from "./review-row-fields";
import { batchTransactionsHref, importUploadHref } from "./review-status";
import { SelectAllNew } from "./review-select-all";
import { ReviewSummary } from "./review-summary";

const FORMAT_LABEL = { csv: "CSV", pdf: "PDF", ai_pdf: "PDF, dibaca AI" } as const;

function rangeLabel(dates: string[]): string {
  const sorted = [...dates].sort();
  const first = parseDateKey(sorted[0] ?? "");
  const last = parseDateKey(sorted[sorted.length - 1] ?? "");
  if (!first || !last) return "";
  return `${formatShortDate(first)} sampai ${formatDateWithYear(last)}`;
}

type Props = {
  review: ImportReview;
  options: Pick<TransactionFormOptions, "categories" | "people">;
};

export function ReviewScreen({ review, options }: Props) {
  const { batch, rows } = review;
  const router = useRouter();
  const toast = useToast();
  const [choices, setChoices] = useState<Choices>(() => initialChoices(rows, batch.accountOwnerId, options.people));
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const firstInvalid = useRef<string | null>(null);

  const categoryGroups = useMemo(() => buildCategoryOptionGroups(options.categories), [options.categories]);
  const newRows = useMemo(() => rows.filter((r) => r.group === "new"), [rows]);
  const possibleRows = useMemo(() => rows.filter((r) => r.group === "possible_duplicate"), [rows]);
  const exactRows = useMemo(() => rows.filter((r) => r.group === "exact_duplicate"), [rows]);
  const counts = useMemo(() => countChoices(rows, choices), [rows, choices]);
  const sharedAccount = batch.accountOwnerId === null;

  useEffect(() => {
    if (showErrors && counts.missingCategory.length === 0) setError(null);
  }, [showErrors, counts.missingCategory.length]);

  const update = useCallback((rowId: string, patch: Partial<Choices[string]>) => {
    setChoices((prev) => {
      const current = prev[rowId];
      return current ? { ...prev, [rowId]: { ...current, ...patch } } : prev;
    });
  }, []);
  const onToggle = useCallback((rowId: string, checked: boolean) => update(rowId, { action: checked ? "import" : "skip" }), [update]);
  const onAction = useCallback((rowId: string, action: RowAction) => update(rowId, { action }), [update]);
  const onCategory = useCallback((rowId: string, categoryId: string) => update(rowId, { categoryId }), [update]);
  const onWho = useCallback((rowId: string, who: BeneficiaryChoice) => update(rowId, { who }), [update]);
  const setAllNew = useCallback(
    (checked: boolean) =>
      setChoices((prev) => {
        const next = { ...prev };
        for (const r of newRows) next[r.id] = { ...next[r.id]!, action: checked ? "import" : "skip" };
        return next;
      }),
    [newRows],
  );

  useEffect(() => {
    const id = firstInvalid.current;
    if (!id) return;
    firstInvalid.current = null;
    document.querySelector<HTMLElement>(`[data-row-id="${id}"] [aria-invalid="true"]`)?.focus();
  }, [showErrors, error]);

  const commit = () => {
    if (counts.missingCategory.length > 0) {
      firstInvalid.current = counts.missingCategory[0] ?? null;
      setShowErrors(true);
      setError(missingCategoryMessage(counts.missingCategory.length));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await commitImportAction(toCommitInput(batch.id, rows, choices, batch.accountOwnerId, options.people));
      if (result.ok) {
        toast.show({ title: commitToastTitle(result.data) });
        router.push(batchTransactionsHref(batch.id));
        return;
      }
      setShowErrors(true);
      setError(result.error);
      if (result.code === "import_link_stale" || result.code === "import_committed") router.refresh();
    });
  };

  const discard = () =>
    startTransition(async () => {
      const result = await discardImportAction(batch.id);
      if (result.ok) {
        setDiscardOpen(false);
        router.push(importUploadHref(batch.accountId));
      } else setError(result.error);
    });

  const invalid = (rowId: string) => showErrors && choices[rowId]?.action === "import" && !choices[rowId]?.categoryId;
  const checkedNew = newRows.filter((r) => choices[r.id]?.action === "import").length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-section text-primary">Tinjau mutasi {batch.accountName}</h2>
        <p className="text-small text-secondary">
          {rows.length} baris dari {FORMAT_LABEL[batch.format]}, {rangeLabel(rows.map((r) => r.date))}
        </p>
      </header>

      {batch.format === "ai_pdf" ? (
        <p className="flex items-start gap-3 rounded-card bg-surface-sunken p-4 text-body text-primary">
          <Icon icon={Info} className="mt-0.5 shrink-0 text-secondary" />
          Mutasi ini dibaca model AI. Cek tanggal, deskripsi, dan nominal setiap baris sebelum mengimpor.
        </p>
      ) : null}
      {review.balanceMismatchCount > 0 ? (
        <p role="status" className="flex items-start gap-3 rounded-card bg-attention/10 p-4 text-body text-primary">
          <Icon icon={TriangleAlert} className="mt-0.5 shrink-0 text-attention" />
          Saldo berjalan tidak cocok di {review.balanceMismatchCount} baris. Baris itu ditandai Perlu dicek; bandingkan dengan file mutasi sebelum mengimpor.
        </p>
      ) : null}

      <ReviewSummary counts={counts} error={error} pending={pending} onCommit={commit} onDiscard={() => setDiscardOpen(true)} />

      {newRows.length > 0 ? (
        <Card as="section" aria-labelledby="impor-baru" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle id="impor-baru">
              Baru ({newRows.length})
            </CardTitle>
            <p className="text-small text-secondary">Belum ada di Kas Kita. Kategori diisi dari transaksi serupa sebelumnya; cek sebelum mengimpor.</p>
          </div>
          <SelectAllNew checked={checkedNew} total={newRows.length} onChange={setAllNew} />
          <div aria-hidden className="hidden grid-cols-[44px_72px_minmax(0,1fr)_minmax(0,420px)_136px] gap-x-4 border-b border-border pb-2 text-caption text-secondary lg:grid">
            <span />
            <span>Tanggal</span>
            <span>Deskripsi</span>
            <span>Kategori dan untuk siapa</span>
            <span className="text-right">Nominal</span>
          </div>
          <ul aria-label="Baris baru">
            {newRows.map((row) => {
              const c = choices[row.id]!;
              return (
                <ReviewNewRow
                  key={row.id}
                  row={row}
                  checked={c.action === "import"}
                  categoryId={c.categoryId}
                  who={c.who}
                  invalid={invalid(row.id)}
                  categoryGroups={categoryGroups}
                  people={options.people}
                  sharedAccount={sharedAccount}
                  onToggle={onToggle}
                  onCategory={onCategory}
                  onWho={onWho}
                />
              );
            })}
          </ul>
        </Card>
      ) : null}

      {possibleRows.length > 0 ? (
        <Card as="section" aria-labelledby="impor-mungkin" className="flex flex-col gap-1">
          <CardTitle id="impor-mungkin">
            Kemungkinan duplikat ({possibleRows.length})
          </CardTitle>
          <p className="text-small text-secondary">
            Akun dan nominal sama dengan transaksi yang sudah tercatat, tanggalnya berselisih paling lama 2 hari. Tidak diimpor sampai kamu memilih.
          </p>
          <ul aria-label="Kemungkinan duplikat">
            {possibleRows.map((row) => {
              const c = choices[row.id]!;
              return (
                <ReviewDuplicateItem
                  key={row.id}
                  row={row}
                  action={c.action}
                  categoryId={c.categoryId}
                  who={c.who}
                  invalid={invalid(row.id)}
                  categoryGroups={categoryGroups}
                  people={options.people}
                  sharedAccount={sharedAccount}
                  onAction={onAction}
                  onCategory={onCategory}
                  onWho={onWho}
                />
              );
            })}
          </ul>
        </Card>
      ) : null}

      <ReviewExactList rows={exactRows} />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent
          title="Batalkan impor ini?"
          description="Baris dan pilihan di layar ini dihapus. File mutasinya bisa diunggah lagi kapan saja."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
                Kembali
              </Button>
              <Button variant="danger" loading={pending} onClick={discard}>
                Batalkan impor
              </Button>
            </>
          }
        />
      </Dialog>
    </div>
  );
}
