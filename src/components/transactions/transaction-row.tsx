import { formatTime } from "@/lib/dates";
import { Amount } from "@/components/money/amount";
import { IdentityDot } from "@/components/identity/identity-dot";
import { cn } from "@/components/ui/cn";
import type { TransactionListRow } from "@/server/queries/transactions";
import { CategoryIconCircle } from "./category-icon";
import { ownerDot, ownerName } from "./labels";
import type { People } from "./types";

export interface RowText {
  title: string;
  subtitle: string;
  filledBy: string | null;
  /** Nilai bertanda untuk <Amount sign="always">; transfer tidak bertanda. */
  signed: bigint;
  transfer: boolean;
}

/** Teks baris transaksi (DESIGN 8); dipakai juga oleh header detail. */
export function rowText(row: TransactionListRow, people: People): RowText {
  const category = row.parentCategoryName ? `${row.parentCategoryName} › ${row.categoryName}` : (row.categoryName ?? "");
  const filledBy = row.ownerId !== null && row.createdBy !== row.ownerId ? row.createdByName : null;
  if (row.kind !== "transfer") {
    return {
      title: row.note || row.categoryName || "Transaksi",
      subtitle: [row.note ? category : null, row.accountName].filter(Boolean).join(" · "),
      filledBy,
      signed: row.kind === "expense" ? -row.amount : row.amount,
      transfer: false,
    };
  }
  // di cakupan Saya/Partner transfer lintas pemilik tampil sebagai "Transfer ke Bersama", bukan pengeluaran
  const route = `${row.accountName} ke ${row.toAccountName ?? "akun lain"}`;
  const title =
    row.flow === "transfer_out"
      ? `Transfer ke ${ownerName(people, row.toOwnerId)}`
      : row.flow === "transfer_in"
        ? `Transfer dari ${ownerName(people, row.ownerId)}`
        : row.note || "Transfer";
  return {
    title,
    subtitle:
      row.flow === "transfer_internal" ? `${row.accountName} · ke ${row.toAccountName ?? "akun lain"}` : [row.note, route].filter(Boolean).join(" · "),
    filledBy,
    signed: row.amount,
    transfer: true,
  };
}

type TransactionRowProps = {
  row: TransactionListRow;
  people: People;
  onOpen: (row: TransactionListRow) => void;
  /** Aksi tambahan di kanan (tombol Konfirmasi untuk draf). */
  trailing?: React.ReactNode;
  className?: string;
};

/** Baris 56px: ikon kategori + titik pemilik, judul dan keterangan, nominal dan waktu. */
export function TransactionRow({ row, people, onOpen, trailing, className }: TransactionRowProps) {
  const text = rowText(row, people);
  const dot = ownerDot(people, row.ownerId);
  const icon = row.kind === "transfer" ? "arrow-left-right" : row.categoryIcon;
  return (
    <div className={cn("flex h-14 items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken"
      >
        <CategoryIconCircle icon={icon}>
          <IdentityDot color={dot.color} shared={dot.shared} label={dot.label} />
        </CategoryIconCircle>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body text-primary">{text.title}</span>
          <span className="truncate text-caption text-secondary">
            {text.subtitle}
            {text.filledBy ? ` · diisi oleh ${text.filledBy}` : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <Amount value={text.signed} sign={text.transfer ? "none" : "always"} className="text-body text-primary" />
          <time dateTime={row.occurredAt.toISOString()} className="text-caption text-secondary">
            {formatTime(row.occurredAt)}
          </time>
        </span>
      </button>
      {trailing}
    </div>
  );
}
