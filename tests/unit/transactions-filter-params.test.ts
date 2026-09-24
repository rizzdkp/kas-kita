import { describe, expect, it } from "vitest";
import {
  EMPTY_QUERY,
  hasActiveFilters,
  parseTransactionQuery,
  queryKey,
  toServerFilters,
  writeTransactionQuery,
  type TransactionQuery,
} from "@/components/transactions/filter-params";

const ACC = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c";
const CAT = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const USER = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const TAG = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

const FULL: TransactionQuery = {
  accountId: ACC,
  categoryId: CAT,
  kind: "expense",
  from: "2026-08-01",
  to: "2026-08-31",
  q: "kopi",
  createdBy: USER,
  tag: "liburan",
  view: "draft",
};

describe("parseTransactionQuery", () => {
  it("membaca semua param kontrak dari URLSearchParams", () => {
    const p = new URLSearchParams({
      akun: ACC,
      kategori: CAT,
      jenis: "expense",
      dari: "2026-08-01",
      sampai: "2026-08-31",
      q: "kopi",
      pencatat: USER,
      tag: "liburan",
      status: "draft",
    });
    expect(parseTransactionQuery(p)).toEqual(FULL);
  });

  it("membaca objek searchParams halaman server, termasuk nilai array", () => {
    expect(parseTransactionQuery({ akun: [ACC, CAT], jenis: "income", tampil: "dihapus" })).toEqual({
      ...EMPTY_QUERY,
      accountId: ACC,
      kind: "income",
      view: "deleted",
    });
  });

  it("menerima ketiga jenis", () => {
    for (const kind of ["income", "expense", "transfer"] as const) {
      expect(parseTransactionQuery({ jenis: kind }).kind).toBe(kind);
    }
  });

  it("tanpa param menghasilkan query kosong", () => {
    expect(parseTransactionQuery(new URLSearchParams())).toEqual(EMPTY_QUERY);
    expect(parseTransactionQuery({})).toEqual(EMPTY_QUERY);
  });

  it("nilai tidak valid diabaikan tanpa error", () => {
    const q = parseTransactionQuery({
      akun: "bukan-uuid",
      kategori: `${CAT},${CAT}`,
      jenis: "pengeluaran",
      dari: "01-08-2026",
      sampai: "2026-8-31",
      pencatat: "rizz",
      status: "confirmed",
      tampil: "semua",
    });
    expect(q).toEqual(EMPTY_QUERY);
  });

  it("tanggal kalender yang mustahil dibuang", () => {
    const q = parseTransactionQuery({ dari: "2026-02-30", sampai: "2026-13-01" });
    expect(q.from).toBeNull();
    expect(q.to).toBeNull();
    expect(parseTransactionQuery({ dari: "2028-02-29" }).from).toBe("2028-02-29");
  });

  it("tampil=dihapus menang atas status=draft", () => {
    expect(parseTransactionQuery({ status: "draft", tampil: "dihapus" }).view).toBe("deleted");
  });

  it("q dan tag dipotong; tag kosong jadi null", () => {
    const q = parseTransactionQuery({ q: "x".repeat(300), tag: `  ${"t".repeat(60)}  ` });
    expect(q.q).toHaveLength(200);
    expect(q.tag).toHaveLength(40);
    expect(parseTransactionQuery({ tag: "   " }).tag).toBeNull();
  });
});

describe("writeTransactionQuery", () => {
  it("menulis kontrak dan bisa dibaca ulang tanpa berubah", () => {
    const written = writeTransactionQuery(new URLSearchParams(), FULL);
    expect(Object.fromEntries(written)).toEqual({
      akun: ACC,
      kategori: CAT,
      jenis: "expense",
      dari: "2026-08-01",
      sampai: "2026-08-31",
      q: "kopi",
      pencatat: USER,
      tag: "liburan",
      status: "draft",
    });
    expect(parseTransactionQuery(written)).toEqual(FULL);
  });

  it("tampilan dihapus ditulis sebagai tampil=dihapus tanpa status", () => {
    const written = writeTransactionQuery(new URLSearchParams("status=draft"), { ...EMPTY_QUERY, view: "deleted" });
    expect(written.toString()).toBe("tampil=dihapus");
  });

  it("mempertahankan scope dan id, menghapus filter yang dikosongkan", () => {
    const base = new URLSearchParams({ scope: "all", id: ACC, akun: ACC, q: "lama", jenis: "income" });
    const written = writeTransactionQuery(base, { ...EMPTY_QUERY, q: "   " });
    expect(written.toString()).toBe(`scope=all&id=${ACC}`);
    // base tidak ikut berubah
    expect(base.get("akun")).toBe(ACC);
  });
});

describe("hasActiveFilters dan queryKey", () => {
  it("tampilan saja bukan filter aktif; q berisi spasi juga bukan", () => {
    expect(hasActiveFilters({ ...EMPTY_QUERY, view: "draft" })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_QUERY, q: "  " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_QUERY, tag: "liburan" })).toBe(true);
  });

  it("kunci berubah bila cakupan atau filter berubah, tidak oleh spasi di q", () => {
    expect(queryKey("me", FULL)).not.toBe(queryKey("all", FULL));
    expect(queryKey("me", FULL)).not.toBe(queryKey("me", { ...FULL, view: "all" }));
    expect(queryKey("me", { ...FULL, q: " kopi " })).toBe(queryKey("me", FULL));
  });
});

describe("toServerFilters", () => {
  const tags = [{ id: TAG, name: "Liburan" }];

  it("menerjemahkan query ke filter listTransactions", () => {
    expect(toServerFilters("all", FULL, tags)).toEqual({
      scope: "all",
      accountIds: [ACC],
      categoryIds: [CAT],
      kinds: ["expense"],
      from: "2026-08-01",
      to: "2026-08-31",
      createdBy: [USER],
      tagIds: [TAG],
      q: "kopi",
      status: "draft",
      deleted: undefined,
    });
  });

  it("tag boleh id atau nama (tanpa beda huruf besar)", () => {
    expect(toServerFilters("me", { ...EMPTY_QUERY, tag: TAG }, tags).tagIds).toEqual([TAG]);
    expect(toServerFilters("me", { ...EMPTY_QUERY, tag: "LIBURAN" }, tags).tagIds).toEqual([TAG]);
  });

  it("tag tidak dikenal menghasilkan daftar kosong, bukan semua transaksi", () => {
    expect(toServerFilters("me", { ...EMPTY_QUERY, tag: "entah" }, tags).tagIds).toEqual(["00000000-0000-0000-0000-000000000000"]);
  });

  it("query kosong tidak mengirim filter apa pun", () => {
    const f = toServerFilters("me", EMPTY_QUERY, tags);
    expect(Object.entries(f).filter(([, v]) => v !== undefined)).toEqual([["scope", "me"]]);
  });

  it("tampilan dihapus mengirim deleted", () => {
    expect(toServerFilters("me", { ...EMPTY_QUERY, view: "deleted" }, tags)).toMatchObject({ deleted: true, status: undefined });
  });
});
