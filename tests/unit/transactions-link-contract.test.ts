import { describe, expect, it } from "vitest";
import { parseScope } from "@/lib/scope";
import { transactionHref, type TransactionLinkFilters } from "@/components/reports/transaction-link";
import { EMPTY_QUERY, parseTransactionQuery, toServerFilters, type TransactionQuery } from "@/components/transactions/filter-params";

// kontrak lintas modul: tautan dari Ringkasan/Laporan (transactionHref) harus dibaca halaman Transaksi (parseTransactionQuery) apa adanya

const CAT = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const ACC = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c";
const USER = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const TAG = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

/** Buka href seperti halaman /transaksi: path, cakupan dari ?scope=, filter dari parseTransactionQuery. */
function open(href: string) {
  const url = new URL(href, "http://localhost");
  return { path: url.pathname, scope: parseScope(url.searchParams.get("scope")), query: parseTransactionQuery(url.searchParams) };
}

const CASES: Array<{ name: string; link: TransactionLinkFilters; query: Partial<TransactionQuery> }> = [
  {
    name: "kategori pengeluaran per bulan (Laporan)",
    link: { scope: "all", categoryIds: [CAT], kinds: ["expense"], from: "2026-08-01", to: "2026-08-31" },
    query: { categoryId: CAT, kind: "expense", from: "2026-08-01", to: "2026-08-31" },
  },
  {
    name: "kategori pemasukan cakupan partner",
    link: { scope: "partner", categoryIds: [CAT], kinds: ["income"], from: "2026-09-01", to: "2026-09-24" },
    query: { categoryId: CAT, kind: "income", from: "2026-09-01", to: "2026-09-24" },
  },
  { name: "draf yang perlu dicek (Ringkasan)", link: { scope: "me", status: "draft" }, query: { view: "draft" } },
  { name: "pengeluaran seminggu (insight)", link: { kinds: ["expense"], from: "2026-09-18", to: "2026-09-24" }, query: { kind: "expense", from: "2026-09-18", to: "2026-09-24" } },
  { name: "pencarian teks dengan spasi dan tanda &", link: { q: "kopi & roti" }, query: { q: "kopi & roti" } },
  { name: "transfer", link: { kinds: ["transfer"] }, query: { kind: "transfer" } },
  {
    name: "akun, pencatat, dan tag",
    link: { accountIds: [ACC], createdBy: [USER], tagIds: [TAG] },
    query: { accountId: ACC, createdBy: USER, tag: TAG },
  },
];

describe("transactionHref → parseTransactionQuery", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const opened = open(transactionHref(c.link));
      expect(opened.path).toBe("/transaksi");
      expect(opened.scope).toBe(c.link.scope ?? "me");
      expect(opened.query).toEqual({ ...EMPTY_QUERY, ...c.query });
    });
  }

  it("filter server hasil tautan sama dengan filter tautan", () => {
    const link: TransactionLinkFilters = { scope: "all", categoryIds: [CAT], kinds: ["expense"], from: "2026-08-01", to: "2026-08-31", tagIds: [TAG] };
    const opened = open(transactionHref(link));
    const server = toServerFilters(opened.scope, opened.query, [{ id: TAG, name: "Liburan" }]);
    expect(server).toMatchObject({ scope: "all", categoryIds: [CAT], kinds: ["expense"], from: "2026-08-01", to: "2026-08-31", tagIds: [TAG] });
  });

  it("tanpa filter membuka daftar lengkap", () => {
    expect(open(transactionHref({}))).toEqual({ path: "/transaksi", scope: "me", query: EMPTY_QUERY });
  });
});
