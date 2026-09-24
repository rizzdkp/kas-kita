import { formatDateWithYear, formatTime } from "@/lib/dates";
import { Amount } from "@/components/money/amount";
import { IdentityDot } from "@/components/identity/identity-dot";
import { Badge } from "@/components/ui/badge";
import { TransactionAttachments } from "@/components/receipts/transaction-attachments";
import type { TransactionDetail } from "@/server/queries/transactions";
import { beneficiaryLabel, KIND_LABEL, ownerDot, personById, SOURCE_LABEL } from "./labels";
import { rowText } from "./transaction-row";
import type { People } from "./types";

function when(d: Date): string {
  return `${formatDateWithYear(d)}, ${formatTime(d)}`;
}

/** Isi detail: pemilik (UX-FLOWS 8), nominal, lalu semua field. */
export function TransactionDetailBody({ detail, names, people }: { detail: TransactionDetail; names: Record<string, string>; people: People }) {
  const text = rowText(detail, people);
  const dot = ownerDot(people, detail.ownerId);
  const owner = personById(people, detail.ownerId);
  const ownerLine = owner && owner.id !== people.me.id ? `Milik ${owner.name}` : owner ? null : "Milik Bersama";
  const category = detail.categoryId ? (names[detail.categoryId] ?? detail.categoryName) : null;

  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Jenis", value: KIND_LABEL[detail.kind] },
    { label: "Tanggal", value: when(detail.occurredAt) },
    detail.kind === "transfer"
      ? { label: "Dari akun", value: detail.accountName }
      : { label: "Akun", value: detail.accountName },
    detail.kind === "transfer" ? { label: "Ke akun", value: detail.toAccountName } : { label: "Kategori", value: category },
    { label: "Untuk", value: detail.kind === "expense" ? beneficiaryLabel(detail.beneficiary, detail.ownerId, people) : null },
    { label: "Catatan", value: detail.note },
    { label: "Tag", value: detail.tags.length ? detail.tags.map((t) => t.name).join(", ") : null },
    { label: "Sumber", value: SOURCE_LABEL[detail.source] ?? null },
    { label: "Diisi oleh", value: `${detail.createdByName}, ${when(detail.createdAt)}` },
    {
      label: "Terakhir diubah",
      value: detail.version > 1 ? `${detail.updatedByName}, ${when(detail.updatedAt)}` : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {ownerLine ? (
          <p className="flex items-center gap-2 text-small text-secondary">
            <IdentityDot color={dot.color} shared={dot.shared} />
            {ownerLine}
          </p>
        ) : null}
        <Amount value={text.signed} sign={text.transfer ? "none" : "always"} size="large" className="text-primary" />
        {detail.status === "draft" || detail.deletedAt ? (
          <div className="flex flex-wrap gap-2">
            {detail.status === "draft" ? <Badge tone="neutral">Perlu dikonfirmasi</Badge> : null}
            {detail.deletedAt ? <Badge tone="neutral">Dihapus {formatDateWithYear(detail.deletedAt)}</Badge> : null}
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2 text-small">
        {rows
          .filter((r) => r.value)
          .map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-secondary">{r.label}</dt>
              <dd className="min-w-0 break-words text-primary">{r.value}</dd>
            </div>
          ))}
      </dl>
      <TransactionAttachments transactionId={detail.id} editable={!detail.deletedAt} />
    </div>
  );
}
