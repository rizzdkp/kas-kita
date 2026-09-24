import { formatShortDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { UserRow } from "@/server/auth/viewer";
import type { Tx } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import type { AuditValue } from "@/server/queries/audit";
import type { AuditAction, AuditDiff } from "./audit";

export interface PartnerEditPayload {
  entity: string;
  entityId: string;
  action: Exclude<AuditAction, "insert">;
  actorId: string;
  actorName: string;
  /** Nama singkat data, misalnya kategori transaksi atau nama akun. */
  label: string;
  /** Tanggal data (transaksi) untuk copy UX-FLOWS bagian 8. */
  occurredAt: string | null;
  changes: Array<{ field: string; before: AuditValue; after: AuditValue }>;
  /** Kalimat siap tampil, misalnya "Rizz mengubah Belanja dapur 12 Sep: Rp 185.000 menjadi Rp 158.000." */
  message: string;
}

const MONEY_FIELDS = new Set(["amount", "opening_balance", "target_amount", "credit_limit", "market_value"]);

function describeValue(field: string, v: AuditValue): string {
  if (v === null) return "kosong";
  if (MONEY_FIELDS.has(field) && typeof v === "string" && /^-?\d+$/.test(v)) return formatRupiah(BigInt(v));
  return String(v);
}

export function partnerEditMessage(p: Omit<PartnerEditPayload, "message">): string {
  const subject = p.occurredAt ? `${p.label} ${formatShortDate(new Date(p.occurredAt))}` : p.label;
  if (p.action === "delete") return `${p.actorName} menghapus ${subject}.`;
  if (p.action === "restore") return `${p.actorName} memulihkan ${subject}.`;
  const amount = p.changes.find((c) => MONEY_FIELDS.has(c.field)) ?? (p.changes.length === 1 ? p.changes[0] : undefined);
  if (!amount) return `${p.actorName} mengubah ${subject}.`;
  return `${p.actorName} mengubah ${subject}: ${describeValue(amount.field, amount.before)} menjadi ${describeValue(amount.field, amount.after)}.`;
}

/** Notifikasi F-NOT-1 untuk pemilik data yang bukan aktor; data Bersama (owner null) tidak memicu notifikasi. */
export async function notifyOwners(
  tx: Tx,
  opts: {
    ownerIds: Array<string | null>;
    actor: UserRow;
    entity: string;
    entityId: string;
    action: Exclude<AuditAction, "insert">;
    label: string;
    occurredAt?: Date | null;
    diff: AuditDiff;
  },
): Promise<void> {
  const recipients = [...new Set(opts.ownerIds.filter((id): id is string => id !== null && id !== opts.actor.id))];
  if (recipients.length === 0) return;
  const base: Omit<PartnerEditPayload, "message"> = {
    entity: opts.entity,
    entityId: opts.entityId,
    action: opts.action,
    actorId: opts.actor.id,
    actorName: opts.actor.displayName,
    label: opts.label,
    occurredAt: opts.occurredAt ? opts.occurredAt.toISOString() : null,
    changes: Object.entries(opts.diff).map(([field, [before, after]]) => ({ field, before, after })),
  };
  const payload: PartnerEditPayload = { ...base, message: partnerEditMessage(base) };
  await tx.insert(notifications).values(recipients.map((recipientId) => ({ recipientId, kind: "partner_edit" as const, payload })));
}
