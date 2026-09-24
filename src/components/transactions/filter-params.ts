import type { Scope } from "@/lib/scope";
import type { TransactionKind } from "./types";

/**
 * Kontrak searchParams /transaksi (dipakai halaman lain untuk menautkan):
 * akun, kategori, jenis (income|expense|transfer), dari, sampai (YYYY-MM-DD), q, pencatat (user id),
 * tag (id atau nama), status=draft, tampil=dihapus, id (buka detail). Cakupan tetap dari `scope`.
 */
export interface TransactionQuery {
  accountId: string | null;
  categoryId: string | null;
  kind: TransactionKind | null;
  from: string | null;
  to: string | null;
  q: string;
  createdBy: string | null;
  tag: string | null;
  view: "all" | "draft" | "deleted";
}

export const EMPTY_QUERY: TransactionQuery = {
  accountId: null,
  categoryId: null,
  kind: null,
  from: null,
  to: null,
  q: "",
  createdBy: null,
  tag: null,
  view: "all",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: readonly TransactionKind[] = ["income", "expense", "transfer"];

export function isUuid(v: string): boolean {
  return UUID.test(v);
}

type ParamSource = { get(name: string): string | null };

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Terima URLSearchParams atau objek searchParams dari halaman server. */
export function toParamSource(params: ParamSource | Record<string, string | string[] | undefined>): ParamSource {
  if (typeof (params as ParamSource).get === "function") return params as ParamSource;
  const record = params as Record<string, string | string[] | undefined>;
  return { get: (name) => first(record[name]) };
}

/** Nilai yang tidak valid diabaikan diam-diam supaya tautan lama tidak membuat halaman error. */
export function parseTransactionQuery(input: ParamSource | Record<string, string | string[] | undefined>): TransactionQuery {
  const p = toParamSource(input);
  const uuid = (name: string) => {
    const v = p.get(name);
    return v && isUuid(v) ? v : null;
  };
  const date = (name: string) => {
    const v = p.get(name);
    return v && DATE_KEY.test(v) ? v : null;
  };
  const kind = p.get("jenis");
  const tag = p.get("tag")?.trim();
  return {
    accountId: uuid("akun"),
    categoryId: uuid("kategori"),
    kind: KINDS.includes(kind as TransactionKind) ? (kind as TransactionKind) : null,
    from: date("dari"),
    to: date("sampai"),
    q: (p.get("q") ?? "").slice(0, 200),
    createdBy: uuid("pencatat"),
    tag: tag ? tag.slice(0, 40) : null,
    view: p.get("tampil") === "dihapus" ? "deleted" : p.get("status") === "draft" ? "draft" : "all",
  };
}

/** Tulis ulang query ke URLSearchParams; parameter lain (scope, id) dipertahankan. */
export function writeTransactionQuery(base: URLSearchParams, q: TransactionQuery): URLSearchParams {
  const next = new URLSearchParams(base.toString());
  const set = (name: string, value: string | null) => {
    if (value) next.set(name, value);
    else next.delete(name);
  };
  set("akun", q.accountId);
  set("kategori", q.categoryId);
  set("jenis", q.kind);
  set("dari", q.from);
  set("sampai", q.to);
  set("q", q.q.trim() || null);
  set("pencatat", q.createdBy);
  set("tag", q.tag);
  set("status", q.view === "draft" ? "draft" : null);
  set("tampil", q.view === "deleted" ? "dihapus" : null);
  return next;
}

/** Filter selain tampilan (Semua/draf/dihapus) yang sedang aktif. */
export function hasActiveFilters(q: TransactionQuery): boolean {
  return Boolean(q.accountId || q.categoryId || q.kind || q.from || q.to || q.q.trim() || q.createdBy || q.tag);
}

/** Kunci stabil untuk mereset daftar saat filter atau cakupan berubah. */
export function queryKey(scope: Scope, q: TransactionQuery): string {
  return JSON.stringify([scope, q.accountId, q.categoryId, q.kind, q.from, q.to, q.q.trim(), q.createdBy, q.tag, q.view]);
}
