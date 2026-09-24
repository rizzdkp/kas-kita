import { parseScope, type Scope } from "@/lib/scope";

/**
 * Kontrak query string /transaksi (dibaca halaman Transaksi, ekspor CSV, dan tautan dari Ringkasan/Laporan).
 * Nilai jamak dipisah koma; tanggal "YYYY-MM-DD" WIB, `sampai` inklusif.
 */
export const TRANSACTION_PARAMS = {
  scope: "scope",
  account: "akun",
  category: "kategori",
  kind: "jenis",
  from: "dari",
  to: "sampai",
  q: "q",
  createdBy: "pencatat",
  tag: "tag",
  status: "status",
} as const;

export type TransactionKind = "income" | "expense" | "transfer";

const KIND_TO_PARAM: Record<TransactionKind, string> = {
  income: "pemasukan",
  expense: "pengeluaran",
  transfer: "transfer",
};
const PARAM_TO_KIND = Object.fromEntries(Object.entries(KIND_TO_PARAM).map(([k, v]) => [v, k])) as Record<string, TransactionKind>;

export interface TransactionLinkFilters {
  scope?: Scope;
  accountIds?: string[];
  categoryIds?: string[];
  kinds?: TransactionKind[];
  from?: string;
  to?: string;
  q?: string;
  createdBy?: string[];
  tagIds?: string[];
  /** "draf" di URL. */
  status?: "draft";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function transactionSearchParams(f: TransactionLinkFilters): URLSearchParams {
  const p = new URLSearchParams();
  const list = (key: string, values?: string[]) => {
    if (values?.length) p.set(key, values.join(","));
  };
  list(TRANSACTION_PARAMS.account, f.accountIds);
  list(TRANSACTION_PARAMS.category, f.categoryIds);
  list(TRANSACTION_PARAMS.kind, f.kinds?.map((k) => KIND_TO_PARAM[k]));
  if (f.from) p.set(TRANSACTION_PARAMS.from, f.from);
  if (f.to) p.set(TRANSACTION_PARAMS.to, f.to);
  if (f.q) p.set(TRANSACTION_PARAMS.q, f.q);
  list(TRANSACTION_PARAMS.createdBy, f.createdBy);
  list(TRANSACTION_PARAMS.tag, f.tagIds);
  if (f.status === "draft") p.set(TRANSACTION_PARAMS.status, "draf");
  if (f.scope && f.scope !== "me") p.set(TRANSACTION_PARAMS.scope, f.scope);
  return p;
}

export function transactionHref(f: TransactionLinkFilters, base = "/transaksi"): string {
  const query = transactionSearchParams(f).toString();
  return query ? `${base}?${query}` : base;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.getAll(key).join(",") || undefined;
  const v = source[key];
  return Array.isArray(v) ? v.join(",") : v;
}

function splitValid(raw: string | undefined, valid: (s: string) => boolean): string[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").map((s) => s.trim()).filter((s) => s && valid(s));
  return values.length ? [...new Set(values)] : undefined;
}

/** Nilai yang tidak valid dibuang diam-diam supaya tautan lama tetap membuka daftar. */
export function parseTransactionSearchParams(source: ParamSource): TransactionLinkFilters {
  const isUuid = (s: string) => UUID.test(s);
  const from = read(source, TRANSACTION_PARAMS.from);
  const to = read(source, TRANSACTION_PARAMS.to);
  const q = read(source, TRANSACTION_PARAMS.q)?.trim().slice(0, 200);
  const kinds = splitValid(read(source, TRANSACTION_PARAMS.kind), (s) => s in PARAM_TO_KIND)?.map((s) => PARAM_TO_KIND[s]!);
  const f: TransactionLinkFilters = {
    scope: parseScope(read(source, TRANSACTION_PARAMS.scope)),
    accountIds: splitValid(read(source, TRANSACTION_PARAMS.account), isUuid),
    categoryIds: splitValid(read(source, TRANSACTION_PARAMS.category), isUuid),
    kinds,
    from: from && DAY.test(from) ? from : undefined,
    to: to && DAY.test(to) ? to : undefined,
    q: q || undefined,
    createdBy: splitValid(read(source, TRANSACTION_PARAMS.createdBy), isUuid),
    tagIds: splitValid(read(source, TRANSACTION_PARAMS.tag), isUuid),
    status: read(source, TRANSACTION_PARAMS.status) === "draf" ? "draft" : undefined,
  };
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as TransactionLinkFilters;
}
