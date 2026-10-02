import { describe, expect, it } from "vitest";
import { detectDecimalSeparator, parseCsvAmount } from "@/server/import/csv/amount";

const value = (v: bigint, marker: "cr" | "db" | null = null) => ({ kind: "value", value: v, marker });

describe("parseCsvAmount gaya Indonesia (desimal koma)", () => {
  it.each([
    ["1.250.000,00", 1_250_000n],
    ["1.250.000", 1_250_000n],
    ["25.000", 25_000n],
    ["25000", 25_000n],
    ["Rp 25.000", 25_000n],
    ["Rp25.000,00", 25_000n],
    ["IDR 8.500.000", 8_500_000n],
    ["12.500,50", 12_501n],
    ["12.500,49", 12_500n],
    ["+75.000", 75_000n],
  ])("%s", (input, expected) => {
    expect(parseCsvAmount(input, ",")).toEqual(value(expected));
  });

  it.each([
    ["-25000", -25_000n],
    ["-25.000", -25_000n],
    ["−25.000", -25_000n],
    ["(25.000)", -25_000n],
    ["(Rp 25.000)", -25_000n],
    ["25.000-", -25_000n],
    ["Rp -25.000", -25_000n],
  ])("negatif %s", (input, expected) => {
    expect(parseCsvAmount(input, ",")).toEqual(value(expected));
  });

  it("menolak titik desimal saat pemisah desimal koma, bukan membacanya 100 kali lipat", () => {
    expect(parseCsvAmount("1250000.00", ",")).toEqual({ kind: "invalid" });
    expect(parseCsvAmount("12.34.5", ",")).toEqual({ kind: "invalid" });
    expect(parseCsvAmount("abc", ",")).toEqual({ kind: "invalid" });
  });

  it("sel kosong atau strip saja dianggap kosong", () => {
    expect(parseCsvAmount("", ",")).toEqual({ kind: "empty" });
    expect(parseCsvAmount("  ", ",")).toEqual({ kind: "empty" });
    expect(parseCsvAmount("-", ",")).toEqual({ kind: "empty" });
  });
});

describe("parseCsvAmount gaya Inggris (desimal titik)", () => {
  it.each([
    ["1,250,000.00", 1_250_000n],
    ["25000.50", 25_001n],
    ["-45000.00", -45_000n],
    ["(18,500.00)", -18_500n],
  ])("%s", (input, expected) => {
    expect(parseCsvAmount(input, ".")).toEqual(value(expected));
  });

  it("menolak koma desimal saat pemisah desimal titik", () => {
    expect(parseCsvAmount("1.250.000,00", ".")).toEqual({ kind: "invalid" });
  });
});

describe("akhiran CR/DB", () => {
  it.each([
    ["8,500,000.00 CR", ".", value(8_500_000n, "cr")],
    ["500,000.00 DB", ".", value(500_000n, "db")],
    ["500,000.00DB", ".", value(500_000n, "db")],
    ["25.000,00 D", ",", value(25_000n, "db")],
    ["25.000,00 K", ",", value(25_000n, "cr")],
    ["DB 10.000", ",", value(10_000n, "db")],
    ["12.000 dr", ",", value(12_000n, "db")],
  ] as const)("%s", (input, dec, expected) => {
    expect(parseCsvAmount(input, dec)).toEqual(expected);
  });
});

describe("detectDecimalSeparator", () => {
  it("memilih koma untuk titik ribuan dan koma desimal", () => {
    expect(detectDecimalSeparator(["1.250.000,00", "25.000", "", "12.500,50"])).toBe(",");
    expect(detectDecimalSeparator(["-45.000", "(18.500)"])).toBe(",");
  });

  it("memilih titik untuk koma ribuan atau titik desimal", () => {
    expect(detectDecimalSeparator(["8,500,000.00 CR", "25,000.00 DB"])).toBe(".");
    expect(detectDecimalSeparator(["-38000.00", "250000.00"])).toBe(".");
  });

  it("default koma bila tidak ada petunjuk", () => {
    expect(detectDecimalSeparator(["25000", "-5000"])).toBe(",");
  });
});
