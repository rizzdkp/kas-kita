import { z } from "zod";
import { ENTITY_ROUTES } from "@/lib/entity-routes";

export type NotificationKind = "partner_edit" | "bill_due" | "budget_over" | "recurring_pending";

export interface PushMessage {
  title: string;
  body: string;
  /** Path dalam app yang dibuka saat notifikasi diklik. */
  url: string;
  /** Notifikasi dengan tag sama saling menggantikan di perangkat. */
  tag?: string;
}

const PUSH_TITLE = "Kas Kita";

// isi push tampil di layar kunci: tanpa nominal, detail ada di app (docs/decisions/0011)
const FALLBACK_BODY: Record<Exclude<NotificationKind, "partner_edit">, string> = {
  bill_due: "Ada tagihan yang jatuh tempo 3 hari lagi.",
  budget_over: "Ada anggaran wajib yang lewat.",
  recurring_pending: "Ada transaksi berulang yang menunggu konfirmasi.",
};

const FALLBACK_URL: Record<NotificationKind, string> = {
  partner_edit: "/notifikasi",
  bill_due: "/tagihan",
  budget_over: "/anggaran",
  recurring_pending: "/transaksi",
};


const payloadSchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  href: z.string().optional(),
  action: z.enum(["update", "delete", "restore"]).optional(),
  actorName: z.string().optional(),
  label: z.string().optional(),
  occurredAt: z.string().nullable().optional(),
});

// path relatif saja; "//" bisa membuka domain lain
function safePath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

// label dari payload bisa memuat angka (nama bebas), jadi digit beruntun diganti supaya tidak ada nominal bocor
function stripAmounts(text: string): string {
  return text.replace(/(rp\.?\s*)?[-−]?\d[\d.,]*(\s*(rb|ribu|jt|juta|k|m))?/gi, "").replace(/\s{2,}/g, " ").trim();
}

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(date).replace(".", "");
}

function partnerEditBody(p: z.infer<typeof payloadSchema>, partnerName: string | null): string {
  const actor = p.actorName ? stripAmounts(p.actorName) : partnerName;
  const label = p.label ? stripAmounts(p.label) : "";
  if (!actor) return "Ada perubahan pada data milikmu.";
  if (!label) return `${actor} mengubah data milikmu.`;
  const date = shortDate(p.occurredAt);
  const subject = date ? `${label} ${date}` : label;
  if (p.action === "delete") return `${actor} menghapus ${subject}.`;
  if (p.action === "restore") return `${actor} memulihkan ${subject}.`;
  return `${actor} mengubah ${subject}.`;
}

/** Isi web push dari satu baris notifikasi; payload.message (yang memuat nominal) tidak pernah dipakai. */
export function buildPushMessage(row: { id: string; kind: NotificationKind; payload: unknown }, partnerName: string | null): PushMessage {
  const parsed = payloadSchema.safeParse(row.payload);
  const p = parsed.success ? parsed.data : {};
  const route = p.entity ? ENTITY_ROUTES[p.entity] : undefined;
  const url = safePath(p.href) ?? (route && p.entityId ? route(p.entityId) : null) ?? FALLBACK_URL[row.kind];
  const body = row.kind === "partner_edit" ? partnerEditBody(p, partnerName) : FALLBACK_BODY[row.kind];
  return { title: PUSH_TITLE, body, url, tag: `kaskita-${row.id}` };
}
