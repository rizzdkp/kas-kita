import Link from "next/link";
import { Repeat } from "lucide-react";
import { formatDateWithYear, formatTime } from "@/lib/dates";
import { Amount } from "@/components/money/amount";
import { IdentityDot } from "@/components/identity/identity-dot";
import { InstitutionBadge } from "@/components/brand/institution-badge";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TransactionAttachments } from "@/components/receipts/transaction-attachments";
import type { TransactionDetail } from "@/server/queries/transactions";
import { beneficiaryLabel, KIND_LABEL, ownerDot, personById, SOURCE_LABEL } from "./labels";
import { rowText } from "./transaction-row";
import type { FormAccount, People } from "./types";

function when(d: Date): string {
  return `${formatDateWithYear(d)}, ${formatTime(d)}`;
}

/** Isi detail: pemilik (UX-FLOWS 8), nominal, lalu semua field. */
type DetailBodyProps = {
  detail: TransactionDetail;
  names: Record<string, string>;
  people: People;
  /** Daftar akun form untuk lencana institusi; tanpa ini akun tampil sebagai teks saja. */
  accounts?: FormAccount[];
};

function AccountValue({ id, name, accounts }: { id: string | null; name: string | null; accounts?: FormAccount[] }) {
  if (!name) return null;
  const account = id ? accounts?.find((a) => a.id === id) : undefined;
  if (!account) return name;
  return (
    <span className="inline-flex items-center gap-2 align-top">
      <InstitutionBadge slug={account.institutionSlug} name={account.institutionName} type={account.type} size="sm" />
      {name}
    </span>
  );
}

export function TransactionDetailBody({ detail, names, people, accounts }: DetailBodyProps) {
  const text = rowText(detail, people);
  const dot = ownerDot(people, detail.ownerId);
  const owner = personById(people, detail.ownerId);
  const ownerLine = owner && owner.id !== people.me.id ? `Milik ${owner.name}` : owner ? null : "Milik Bersama";
  const category = detail.categoryId ? (names[detail.categoryId] ?? detail.categoryName) : null;

  const accountValue = <AccountValue id={detail.accountId} name={detail.accountName} accounts={accounts} />;
  const categoryValue = category ? (
    <span className="inline-flex items-center gap-2 align-top">
      <CategoryIcon icon={detail.categoryIcon} name={detail.categoryName} parentName={detail.parentCategoryName} kind={detail.kind} size="sm" />
      {category}
    </span>
  ) : null;
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Jenis", value: KIND_LABEL[detail.kind] },
    { label: "Tanggal", value: when(detail.occurredAt) },
    { label: detail.kind === "transfer" ? "Dari akun" : "Akun", value: accountValue },
    detail.kind === "transfer"
      ? { label: "Ke akun", value: <AccountValue id={detail.toAccountId} name={detail.toAccountName} accounts={accounts} /> }
      : { label: "Kategori", value: categoryValue },
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
          .filter((r) => r.value && !(r.label === "Ke akun" && !detail.toAccountName))
          .map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-secondary">{r.label}</dt>
              <dd className="min-w-0 break-words text-primary">{r.value}</dd>
            </div>
          ))}
      </dl>
      {!detail.deletedAt && detail.source !== "recurring" ? (
        <Link href={`/transaksi/berulang?dari=${detail.id}`} className={buttonClassName("secondary", "self-start")}>
          <Icon icon={Repeat} />
          Jadikan berulang
        </Link>
      ) : null}
      <TransactionAttachments transactionId={detail.id} editable={!detail.deletedAt} />
    </div>
  );
}
