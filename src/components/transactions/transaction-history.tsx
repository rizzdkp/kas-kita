import { formatDateWithYear, formatTime } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { AuditValue, HistoryEntry } from "@/server/queries/audit";
import { beneficiaryLabel, KIND_LABEL, SOURCE_LABEL, STATUS_LABEL } from "./labels";
import type { Beneficiary, People, TransactionKind } from "./types";

const FIELD_LABEL: Record<string, string> = {
  kind: "Jenis",
  amount: "Nominal",
  account_id: "Akun",
  to_account_id: "Akun tujuan",
  category_id: "Kategori",
  occurred_at: "Tanggal",
  note: "Catatan",
  beneficiary: "Untuk",
  status: "Status",
  source: "Sumber",
  tags: "Tag",
};

const ACTION_TEXT: Record<HistoryEntry["action"], string> = {
  insert: "mencatat transaksi ini",
  update: "mengubah",
  delete: "menghapus transaksi ini",
  restore: "memulihkan transaksi ini",
};

type Context = { names: Record<string, string>; people: People; ownerId: string | null };

/** Nilai audit mentah (uuid, ISO, string digit) jadi teks yang dibaca orang. */
export function humanizeValue(field: string, value: AuditValue, ctx: Context): string {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return field === "tags" ? "tanpa tag" : "kosong";
  }
  switch (field) {
    case "amount":
      return typeof value === "string" && /^\d+$/.test(value) ? formatRupiah(BigInt(value)) : String(value);
    case "occurred_at": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : `${formatDateWithYear(d)}, ${formatTime(d)}`;
    }
    case "account_id":
    case "to_account_id":
      return ctx.names[String(value)] ?? "akun yang dihapus";
    case "category_id":
      return ctx.names[String(value)] ?? "kategori yang dihapus";
    case "kind":
      return KIND_LABEL[value as TransactionKind] ?? String(value);
    case "beneficiary":
      return beneficiaryLabel(value as Beneficiary, ctx.ownerId, ctx.people);
    case "status":
      return STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? String(value);
    case "source":
      return SOURCE_LABEL[String(value)] ?? String(value);
    case "tags":
      return Array.isArray(value) ? value.map(String).join(", ") : String(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

type HistoryPanelProps = {
  history: HistoryEntry[];
  names: Record<string, string>;
  people: People;
  ownerId: string | null;
};

/** Panel Riwayat F-HIST-2: siapa, kapan, field, nilai lama menjadi nilai baru. */
export function HistoryPanel({ history, names, people, ownerId }: HistoryPanelProps) {
  const ctx = { names, people, ownerId };
  return (
    <section aria-labelledby="riwayat-transaksi" className="flex flex-col gap-3">
      <h3 id="riwayat-transaksi" className="text-card text-primary">
        Riwayat
      </h3>
      {history.length === 0 ? (
        <p className="text-small text-secondary">Belum ada perubahan tercatat.</p>
      ) : (
        <ol className="flex flex-col">
          {history.map((entry) => {
            const changes = entry.action === "update" ? entry.changes.filter((c) => FIELD_LABEL[c.field]) : [];
            return (
              <li key={entry.id} className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0">
                <p className="text-small text-primary">
                  <span className="font-medium">{entry.actorName}</span> {ACTION_TEXT[entry.action]}
                </p>
                <time dateTime={entry.at.toISOString()} className="text-caption text-secondary">
                  {formatDateWithYear(entry.at)}, {formatTime(entry.at)}
                </time>
                {changes.length > 0 ? (
                  <dl className="mt-1 flex flex-col gap-1">
                    {changes.map((c) => (
                      <div key={c.field} className="flex flex-wrap gap-x-2 text-small">
                        <dt className="text-secondary">{FIELD_LABEL[c.field]}</dt>
                        <dd className="text-primary">
                          <span className="tabular">{humanizeValue(c.field, c.before, ctx)}</span>
                          <span aria-hidden className="px-1 text-secondary">
                            →
                          </span>
                          <span className="sr-only"> menjadi </span>
                          <span className="tabular">{humanizeValue(c.field, c.after, ctx)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
