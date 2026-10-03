import { afterEach, describe, expect, it, vi } from "vitest";
import type { StatementParser } from "@/server/import/pdf/types";
import { parseStatement, statementParsers } from "@/server/import/pdf/registry";

const good: StatementParser = {
  slug: "bank-baik",
  canParse: (t) => t.includes("BANK BAIK"),
  parse: () => [{ date: "2026-08-01", time: null, description: "SETORAN", amount: 1000n, balance: null, raw: {} }],
};

const brokenDetect: StatementParser = {
  slug: "bank-rusak-deteksi",
  canParse: () => {
    throw new TypeError("NOMINAL 1.234.567 RAHASIA");
  },
  parse: () => [],
};

const brokenParse: StatementParser = {
  slug: "bank-rusak-parse",
  canParse: (t) => t.includes("BANK RUSAK"),
  parse: () => {
    throw new RangeError("baris 3: TRANSFER KE ANDI 250.000");
  },
};

afterEach(() => vi.restoreAllMocks());

describe("parseStatement (F-IN-5 AC4)", () => {
  it("parser referensi terdaftar dengan slug contoh-bank", () => {
    expect(statementParsers.map((p) => p.slug)).toContain("contoh-bank");
  });

  it("parser yang melempar saat deteksi dilewati; institusi lain tetap terbaca", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = parseStatement(["BANK BAIK\nmutasi"], [brokenDetect, brokenParse, good]);
    expect(out).toMatchObject({ kind: "parsed", slug: "bank-baik" });
  });

  it("parser yang gagal saat parse menghasilkan failed untuk institusinya saja", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseStatement(["BANK RUSAK"], [brokenParse, good])).toEqual({ kind: "failed", slug: "bank-rusak-parse" });
    expect(parseStatement(["BANK BAIK"], [brokenParse, good]).kind).toBe("parsed");
  });

  it("log kegagalan hanya slug dan jenis error, tanpa isi mutasi", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    parseStatement(["BANK RUSAK"], [brokenDetect, brokenParse]);
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("bank-rusak-parse");
    expect(logged).toContain("RangeError");
    expect(logged).not.toMatch(/1\.234\.567|250\.000|ANDI|RAHASIA/);
  });

  it("tidak ada parser yang cocok: unrecognized", () => {
    expect(parseStatement(["LAPORAN LAIN"], [good])).toEqual({ kind: "unrecognized" });
    expect(parseStatement([], [good])).toEqual({ kind: "unrecognized" });
  });
});
