"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { focusQuickAdd } from "@/components/glass/quick-add-bar";
import type { Scope } from "@/lib/scope";
import type { TransactionQuery } from "@/components/transactions/filter-params";

type EmptyProps = {
  scope: Scope;
  view: TransactionQuery["view"];
  filtered: boolean;
  partnerName: string | null;
  onClearFilters: () => void;
  onRecordForPartner: () => void;
};

/** Kosong karena belum ada data berbeda dengan kosong karena filter (UX-FLOWS 10). */
export function TransactionsEmpty({ scope, view, filtered, partnerName, onClearFilters, onRecordForPartner }: EmptyProps) {
  if (filtered) {
    return (
      <EmptyState className="px-3" title="Tidak ada transaksi yang cocok" action={<Button onClick={onClearFilters}>Hapus semua filter</Button>}>
        Coba longgarkan filter, misalnya perlebar rentang tanggal atau hapus kata pencarian.
      </EmptyState>
    );
  }
  if (view === "deleted") {
    return (
      <EmptyState className="px-3" title="Baru dihapus masih kosong">
        Transaksi yang dihapus tersimpan di sini selama 30 hari dan bisa dipulihkan.
      </EmptyState>
    );
  }
  if (view === "draft") {
    return (
      <EmptyState className="px-3" title="Tidak ada yang perlu dikonfirmasi">
        Transaksi berulang yang menunggu konfirmasi akan muncul di sini pada tanggalnya.
      </EmptyState>
    );
  }
  if (scope === "partner" && partnerName) {
    return (
      <EmptyState
        className="px-3"
        title={`${partnerName} belum mencatat transaksi`}
        action={
          <Button onClick={onRecordForPartner}>
            Catat untuk {partnerName}
          </Button>
        }
      >
        Kamu bisa mencatat atas namanya dari sini.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      className="px-3"
      title="Catat transaksi pertama"
      action={
        <Button onClick={focusQuickAdd}>
          Mulai mengetik
        </Button>
      }
    >
      Ketik di bar bawah, misalnya &ldquo;makan siang 35rb bca&rdquo;.
    </EmptyState>
  );
}
