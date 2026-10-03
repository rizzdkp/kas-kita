import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/server/import/pdf/extract-text";
import { contohBankParser } from "@/server/import/pdf/parsers/contoh-bank";
import { parseStatement } from "@/server/import/pdf/registry";
import { markBalanceMismatches } from "@/server/import/pdf/verify-balance";
import { CONTOH_BANK_PASSWORD, generateAll } from "../fixtures/statements/generate";

const dir = join(process.cwd(), "tests/fixtures/statements");
const read = (name: string) => readFileSync(join(dir, name));

async function pagesOf(name: string, password?: string): Promise<string[]> {
  const out = await extractPdfText(read(name), password);
  if (out.kind !== "ok") throw new Error(`fixture ${name} tidak terbaca: ${out.kind}`);
  return out.pages;
}

describe("fixture PDF contoh-bank", () => {
  it("generator deterministik dan fixture di repo sama dengan hasil generate", () => {
    const tmp = mkdtempSync(join(tmpdir(), "kaskita-pdf-"));
    try {
      const files = generateAll(tmp);
      for (const [name, data] of Object.entries(files)) expect(read(name).equals(data), name).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("parser referensi contoh-bank", () => {
  it("mengenali halaman pertama dan menolak format lain", async () => {
    const [first] = await pagesOf("contoh-bank/mutasi-agustus.pdf");
    expect(contohBankParser.canParse(first!)).toBe(true);
    const [other] = await pagesOf("tidak-dikenal/dompet-contoh.pdf");
    expect(contohBankParser.canParse(other!)).toBe(false);
  });

  it("hasil parse sama dengan snapshot (ARCHITECTURE 6)", async () => {
    const rows = contohBankParser.parse(await pagesOf("contoh-bank/mutasi-agustus.pdf"));
    expect(rows).toMatchSnapshot();
  });

  it("13 baris dua halaman: keterangan lanjutan digabung, jam kosong jadi null, tanda dari D/K", async () => {
    const rows = contohBankParser.parse(await pagesOf("contoh-bank/mutasi-agustus.pdf"));
    expect(rows).toHaveLength(13);
    expect(rows[0]).toMatchObject({ date: "2026-08-01", time: "07:12", description: "GAJI AGUSTUS 2026 PT CONTOH SEJAHTERA", amount: 12_500_000n, balance: 17_500_000n });
    expect(rows[2]).toMatchObject({ date: "2026-08-03", time: null, amount: -15_000n });
    expect(rows.map((r) => r.raw.halaman)).toEqual([..."11111111", ..."22222"]);
    // 5.000.000 saldo awal − 4.650.597 debit + 13.251.234 kredit = 13.600.637 saldo akhir
    expect(rows.reduce((s, r) => s + r.amount, 5_000_000n)).toBe(13_600_637n);
    expect(rows.at(-1)!.balance).toBe(13_600_637n);
  });

  it("saldo berjalan konsisten: tidak ada baris yang ditandai", async () => {
    const outcome = parseStatement(await pagesOf("contoh-bank/mutasi-agustus.pdf"));
    expect(outcome.kind).toBe("parsed");
    if (outcome.kind !== "parsed") return;
    expect(markBalanceMismatches(outcome.rows).mismatches).toBe(0);
  });

  it("PDF berpassword dengan password benar menghasilkan baris yang sama", async () => {
    const plain = contohBankParser.parse(await pagesOf("contoh-bank/mutasi-agustus.pdf"));
    const locked = contohBankParser.parse(await pagesOf("contoh-bank/mutasi-agustus-berpassword.pdf", CONTOH_BANK_PASSWORD));
    expect(locked).toEqual(plain);
  });

  it("saldo tercetak salah menandai baris itu dan baris sesudahnya", async () => {
    const outcome = parseStatement(await pagesOf("contoh-bank/mutasi-agustus-saldo-selisih.pdf"));
    if (outcome.kind !== "parsed") throw new Error(outcome.kind);
    const { rows, mismatches } = markBalanceMismatches(outcome.rows);
    // baris 7 (BELANJA SUPERMARKET): 14.890.000 − 612.450 = 14.277.550, tercetak 14.277.500
    // baris 8: 14.277.500 tercetak + 750.000 = 15.027.500, tercetak 15.027.550
    expect(mismatches).toBe(2);
    expect(rows.map((r, i) => (r.raw.__balanceMismatch === "1" ? i : -1)).filter((i) => i >= 0)).toEqual([6, 7]);
  });

  it("baris dengan tanggal mustahil membuat parser gagal, bukan menebak", () => {
    const page = ["BANK CONTOH", "REKENING KORAN ELEKTRONIK", "TANGGAL  JAM  KETERANGAN  MUTASI  D/K  SALDO", "31/02/2026  10:00  X  1.000,00  DB  9.000,00"].join("\n");
    expect(() => contohBankParser.parse([page])).toThrow();
  });
});
