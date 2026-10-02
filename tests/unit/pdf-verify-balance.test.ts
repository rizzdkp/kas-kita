import { describe, expect, it } from "vitest";
import type { ParsedRow } from "@/server/import/types";
import { markBalanceMismatches } from "@/server/import/pdf/verify-balance";

const row = (amount: bigint, balance: bigint | null): ParsedRow => ({ date: "2026-08-01", time: null, description: "x", amount, balance, raw: { n: String(amount) } });
const flagged = (rows: ParsedRow[]) => rows.map((r) => r.raw.__balanceMismatch === "1");

describe("markBalanceMismatches", () => {
  it("saldo sebelumnya + nominal = saldo: tidak ada tanda", () => {
    // 100.000 → −25.000 → 75.000 → +50.000 → 125.000
    const out = markBalanceMismatches([row(100_000n, 100_000n), row(-25_000n, 75_000n), row(50_000n, 125_000n)]);
    expect(out.mismatches).toBe(0);
    expect(flagged(out.rows)).toEqual([false, false, false]);
  });

  it("baris pertama tidak bisa dicek; selisih di baris kedua ditandai tanpa mengubah raw lain", () => {
    // 100.000 − 25.000 = 75.000, tercetak 70.000
    const out = markBalanceMismatches([row(100_000n, 100_000n), row(-25_000n, 70_000n)]);
    expect(out.mismatches).toBe(1);
    expect(out.rows[1]!.raw).toEqual({ n: "-25000", __balanceMismatch: "1" });
  });

  it("baris tanpa saldo meneruskan saldo hitungan ke baris berikutnya", () => {
    // 100.000 → (−10.000, saldo tidak tertulis) 90.000 → −5.000 = 85.000 tercetak 85.000
    const ok = markBalanceMismatches([row(0n + 100_000n, 100_000n), row(-10_000n, null), row(-5_000n, 85_000n)]);
    expect(ok.mismatches).toBe(0);
    const bad = markBalanceMismatches([row(100_000n, 100_000n), row(-10_000n, null), row(-5_000n, 95_000n)]);
    expect(flagged(bad.rows)).toEqual([false, false, true]);
  });

  it("mutasi tanpa kolom saldo sama sekali tidak pernah ditandai", () => {
    expect(markBalanceMismatches([row(-1n, null), row(5n, null)]).mismatches).toBe(0);
  });

  it("tidak memutasi array masukan", () => {
    const input = [row(100n, 100n), row(1n, 999n)];
    markBalanceMismatches(input);
    expect(input[1]!.raw.__balanceMismatch).toBeUndefined();
  });
});
