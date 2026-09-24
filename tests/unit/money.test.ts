import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT, deserializeMoney, formatAmountInput, formatCompact, formatPercent, formatRupiah,
  parseAmount, percentOf, serializeMoney, toSafeNumber,
} from "@/lib/money";

describe("parseAmount", () => {
  it.each([
    ["25rb", 25_000n],
    ["25 rb", 25_000n],
    ["25ribu", 25_000n],
    ["25RB", 25_000n],
    ["1,5jt", 1_500_000n],
    ["1.5jt", 1_500_000n],
    ["1,5 juta", 1_500_000n],
    ["1,25jt", 1_250_000n],
    ["8,5jt", 8_500_000n],
    ["1.500jt", 1_500_000_000n],
    ["25k", 25_000n],
    ["25K", 25_000n],
    ["2,5k", 2_500n],
    ["Rp 25.000", 25_000n],
    ["Rp25.000", 25_000n],
    ["rp. 25.000", 25_000n],
    ["Rp 25.000,-", 25_000n],
    ["IDR 1.250.000", 1_250_000n],
    ["25.000", 25_000n],
    ["1.250.000", 1_250_000n],
    ["25.000,00", 25_000n],
    ["1.250.000,50", 1_250_001n],
    ["25000", 25_000n],
    ["2M", 2_000_000_000n],
    ["2 miliar", 2_000_000_000n],
    ["2,1 milyar", 2_100_000_000n],
    ["0", 0n],
    ["  25rb  ", 25_000n],
  ])("%s -> %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("menerima negatif dengan tanda minus biasa dan U+2212", () => {
    expect(parseAmount("-25rb")).toBe(-25_000n);
    expect(parseAmount("−25rb")).toBe(-25_000n);
    expect(parseAmount("-Rp 25.000")).toBe(-25_000n);
    expect(parseAmount("Rp -25.000")).toBe(-25_000n);
    expect(parseAmount("-0")).toBe(0n);
  });

  it("membulatkan pecahan rupiah setengah ke atas tanpa float", () => {
    expect(parseAmount("1,2345k")).toBe(1_235n);
    expect(parseAmount("1,2344k")).toBe(1_234n);
    expect(parseAmount("0,0005rb")).toBe(1n);
    expect(parseAmount("25,4")).toBe(25n);
    expect(parseAmount("25,5")).toBe(26n);
    // 0.1 + 0.2 di float = 0.30000000000000004, di sini harus tepat
    expect(parseAmount("0,3jt")).toBe(300_000n);
    expect(parseAmount("1,1jt")).toBe(1_100_000n);
  });

  it.each([
    "", " ", "abc", "rb", "Rp", "25xx", "1,5,0jt", "1.2.3", "25,000", "1,250,000.00", "12.34.567",
    "--25", "25rb rb", ".5jt", "25 000", "1.25.000", "25.00.000", "Rp -", "+-5",
  ])("menolak %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it("menjaga batas bigint Postgres", () => {
    expect(parseAmount("9223372036854775807")).toBe(MAX_AMOUNT);
    expect(parseAmount("9223372036854775808")).toBeNull();
    expect(parseAmount("9.999.999 M")).toBe(9_999_999_000_000_000n);
    expect(parseAmount("1".repeat(40))).toBeNull();
  });

  it("tidak melempar untuk input non-string", () => {
    expect(parseAmount(undefined as unknown as string)).toBeNull();
  });
});

describe("formatRupiah", () => {
  it("format lengkap dengan titik ribuan", () => {
    expect(formatRupiah(1_250_000n)).toBe("Rp 1.250.000");
    expect(formatRupiah(0n)).toBe("Rp 0");
    expect(formatRupiah(999n)).toBe("Rp 999");
    expect(formatRupiah(1_000n)).toBe("Rp 1.000");
  });

  it("negatif memakai U+2212", () => {
    expect(formatRupiah(-25_000n)).toBe("−Rp 25.000");
    expect(formatRupiah(-25_000n, { sign: true })).toBe("−Rp 25.000");
  });

  it("sign: true menambah plus untuk positif, tidak untuk nol", () => {
    expect(formatRupiah(8_500_000n, { sign: true })).toBe("+Rp 8.500.000");
    expect(formatRupiah(0n, { sign: true })).toBe("Rp 0");
  });

  it("angka besar di atas MAX_SAFE_INTEGER tetap tepat", () => {
    expect(formatRupiah(MAX_AMOUNT)).toBe("Rp 9.223.372.036.854.775.807");
    expect(formatRupiah(9_007_199_254_740_993n)).toBe("Rp 9.007.199.254.740.993");
  });
});

describe("formatCompact", () => {
  it.each([
    [0n, "0"],
    [500n, "500"],
    [850_000n, "850 rb"],
    [1_000n, "1 rb"],
    [1_500n, "1,5 rb"],
    [1_250_000n, "1,25 jt"],
    [1_255_000n, "1,26 jt"],
    [1_254_999n, "1,25 jt"],
    [1_200_000n, "1,2 jt"],
    [5_000_000n, "5 jt"],
    [2_100_000_000n, "2,1 M"],
    [999_999n, "1 jt"],
    [999_994n, "999,99 rb"],
    [1_500_000_000_000n, "1.500 M"],
    [-5_000_000n, "−5 jt"],
    [-850n, "−850"],
  ])("%s -> %s", (v, expected) => {
    expect(formatCompact(v)).toBe(expected);
  });
});

describe("formatPercent dan percentOf", () => {
  it("koma desimal maksimal 1 desimal", () => {
    expect(formatPercent(30.8)).toBe("30,8%");
    expect(formatPercent(30.84)).toBe("30,8%");
    expect(formatPercent(30.86)).toBe("30,9%");
    expect(formatPercent(30)).toBe("30%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(-12.5)).toBe("−12,5%");
    expect(formatPercent(-0.01)).toBe("0%");
    expect(formatPercent(1234.5)).toBe("1.234,5%");
  });

  it("percentOf dari bigint", () => {
    // (8.500.000 - 5.882.000) / 8.500.000 = 30,8%
    const pct = percentOf(8_500_000n - 5_882_000n, 8_500_000n);
    expect(pct).toBeCloseTo(30.8, 3);
    expect(formatPercent(pct!)).toBe("30,8%");
    expect(percentOf(1n, 3n)).toBeCloseTo(33.3333, 3);
    expect(percentOf(-1n, 4n)).toBe(-25);
    expect(percentOf(5n, 0n)).toBeNull();
    expect(percentOf(MAX_AMOUNT, MAX_AMOUNT)).toBe(100);
  });
});

describe("formatAmountInput", () => {
  it.each([
    ["25000", "25.000"],
    ["25.0000", "250.000"],
    ["1250000", "1.250.000"],
    ["100", "100"],
    ["", ""],
    ["25rb", "25rb"],
    ["1,5jt", "1,5jt"],
    ["1.5", "1.5"],
    ["1.", "1."],
    ["25000,5", "25.000,5"],
    ["-25000", "-25.000"],
    ["Rp 25000", "Rp 25.000"],
    ["007", "7"],
  ])("%j -> %j", (raw, expected) => {
    expect(formatAmountInput(raw)).toBe(expected);
  });

  it("hasil format tetap bisa di-parse ke nilai yang sama", () => {
    expect(parseAmount(formatAmountInput("1250000"))).toBe(1_250_000n);
  });
});

describe("toSafeNumber dan serialisasi", () => {
  it("toSafeNumber menerima nilai aman dan menolak yang terlalu besar", () => {
    expect(toSafeNumber(1_250_000n)).toBe(1_250_000);
    expect(toSafeNumber(-25_000n)).toBe(-25_000);
    expect(toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
    expect(() => toSafeNumber(-BigInt(Number.MAX_SAFE_INTEGER) - 1n)).toThrow(RangeError);
  });

  it("serialize dan deserialize bolak-balik tanpa kehilangan presisi", () => {
    for (const v of [0n, 25_000n, -25_000n, MAX_AMOUNT]) {
      const s = serializeMoney(v);
      expect(typeof s).toBe("string");
      expect(deserializeMoney(JSON.parse(JSON.stringify(s)) as string)).toBe(v);
    }
    expect(() => deserializeMoney("1.5")).toThrow(TypeError);
    expect(() => deserializeMoney("abc")).toThrow(TypeError);
  });
});
