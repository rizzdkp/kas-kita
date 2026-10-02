import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectDelimiter, detectHeaderRow } from "@/server/import/csv/detect";
import { inspectCsv, templateFits } from "@/server/import/csv/inspect";
import { csvMappingSchema } from "@/server/import/csv/mapping-schema";
import { CsvMappingError, decodeTable, hasBlockingSkips, parseCsvTable } from "@/server/import/csv/parse";
import type { CsvMapping } from "@/server/import/types";

const TODAY = "2026-09-24";
const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures/imports/csv", name));

function parseFixture(name: string, override: Partial<CsvMapping> = {}) {
  const bytes = fixture(name);
  const inspection = inspectCsv(bytes, TODAY);
  const mapping = { ...inspection.suggestion, ...override };
  return { inspection, mapping, result: parseCsvTable(decodeTable(bytes, mapping), mapping, inspection.referenceDate) };
}

describe("detectDelimiter dan detectHeaderRow", () => {
  it("koma, titik koma, dan tab", () => {
    expect(detectDelimiter("a,b,c\n1,2,3\n4,5,6")).toBe(",");
    expect(detectDelimiter("Tanggal;Nominal\n01/09/2026;1.250.000,00\n02/09/2026;25.000,00")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2,5\t3")).toBe("\t");
  });

  it("header di bawah baris judul bank", () => {
    const rows = [["LAPORAN MUTASI"], ["Nomor", "123"], [], ["Tanggal", "Keterangan", "Nominal"], ["01/09/2026", "Kopi", "-25.000"]];
    expect(detectHeaderRow(rows, TODAY)).toBe(3);
  });

  it("-1 untuk tabel tanpa header", () => {
    const rows = [["01/09/2026", "Kopi", "-25.000"], ["02/09/2026", "Parkir", "-5.000"]];
    expect(detectHeaderRow(rows, TODAY)).toBe(-1);
  });
});

describe("fixture gaya BCA: tanggal DD/MM tanpa tahun, kolom Mutasi dengan akhiran CR/DB", () => {
  const { inspection, mapping, result } = parseFixture("bca-mutasi.csv");

  it("deteksi", () => {
    expect(mapping).toMatchObject({
      encoding: "utf-8",
      delimiter: ",",
      headerRow: 6,
      dateColumn: "Tanggal Transaksi",
      dateFormat: "DD/MM/YYYY",
      descriptionColumn: "Keterangan",
      amountColumn: "Mutasi",
      debitColumn: null,
      creditColumn: null,
      decimalSeparator: ".",
      balanceColumn: "Saldo",
    });
    expect(inspection.referenceDate).toBe("2026-09-20");
  });

  it("baris dan tanda dari CR/DB", () => {
    expect(result.rows.map((r) => [r.date, r.amount])).toEqual([
      ["2026-09-01", 8_500_000n],
      ["2026-09-02", -500_000n],
      ["2026-09-03", -25_000n],
      ["2026-09-05", -1_250_000n],
      ["2026-09-10", -10_000n],
      // 3.512,45 dibulatkan ke rupiah terdekat
      ["2026-09-15", 3_512n],
    ]);
    expect(result.rows[1]!.description).toBe("TARIKAN ATM 02/09 ATM CONTOH, JAKARTA");
    expect(result.rows[3]!.description).toBe("TRSF E-BANKING DB 0509/FTSCY/WS95051 1250000.00 KOS BULAN SEPTEMBER");
    expect(result.rows[0]!.balance).toBe(11_250_000n);
    expect(result.rows[0]!.raw).toMatchObject({ "Tanggal Transaksi": "'01/09", Cabang: "0000" });
  });

  it("baris tertunda dan ringkasan dilaporkan, tidak menahan templat otomatis", () => {
    expect(result.skipped.map((s) => s.kind)).toEqual(["pending", "summary", "summary", "summary", "summary"]);
    expect(hasBlockingSkips(result.skipped)).toBe(false);
  });
});

describe("fixture debit/kredit terpisah, titik ribuan, koma desimal, bulan Indonesia", () => {
  const { mapping, result } = parseFixture("debit-kredit-id.csv");

  it("deteksi", () => {
    expect(mapping).toMatchObject({ delimiter: ",", headerRow: 0, dateFormat: "DD MMM YYYY", debitColumn: "Debit", creditColumn: "Kredit", amountColumn: null, decimalSeparator: "," });
  });

  it("debit keluar, kredit masuk", () => {
    expect(result.rows.map((r) => [r.date, r.amount, r.description])).toEqual([
      ["2026-09-02", 12_000_000n, "Gaji bulan September"],
      ["2026-09-03", -1_250_000n, "Belanja Supermarket Contoh, cabang 2"],
      ["2026-08-05", -200_000n, "Isi saldo GoPay"],
      ["2026-08-07", 12_501n, "Cashback"],
      ["2026-10-10", -250_000n, "Listrik token"],
    ]);
    expect(result.skipped).toEqual([]);
  });
});

describe("fixture satu kolom bertanda, titik koma, UTF-8 ber-BOM", () => {
  const { mapping, result } = parseFixture("nominal-bertanda.csv");

  it("deteksi termasuk kolom waktu", () => {
    expect(mapping).toMatchObject({ encoding: "utf-8", delimiter: ";", dateColumn: "Tanggal", dateFormat: "YYYY-MM-DD", amountColumn: "Nominal", timeColumn: "Waktu", descriptionColumn: "Uraian", decimalSeparator: "," });
  });

  it("tanda minus, kurung akuntansi, dan plus", () => {
    expect(result.rows.map((r) => [r.time, r.amount])).toEqual([
      ["08:15", 1_000_000n],
      ["12:40", -45_000n],
      ["19:05", -18_500n],
      ["07:30", -5_000n],
      ["21:10", 75_000n],
    ]);
  });

  it("nilai positif berarti uang keluar bila arah dibalik", () => {
    const flipped = parseFixture("nominal-bertanda.csv", { amountPositiveIsIncome: false }).result;
    expect(flipped.rows[0]!.amount).toBe(-1_000_000n);
    expect(flipped.rows[1]!.amount).toBe(45_000n);
  });
});

describe("fixture Windows-1252 dengan tab dan desimal titik", () => {
  const { mapping, result } = parseFixture("windows-1252.csv");

  it("é dan û terbaca", () => {
    expect(mapping).toMatchObject({ encoding: "windows-1252", delimiter: "\t", dateColumn: "Date", descriptionColumn: "Description", amountColumn: "Amount", decimalSeparator: "." });
    expect(result.rows.map((r) => r.description)).toEqual(["Café Kopi Contoh", "Crème brûlée Toko Kue", "Transfer masuk Nadía"]);
    expect(result.rows.map((r) => r.amount)).toEqual([-38_000n, -65_000n, 250_000n]);
  });
});

describe("fixture dengan judul bank di atas tabel dan baris rusak", () => {
  const { mapping, result, inspection } = parseFixture("ringkasan-header.csv");

  it("header setelah judul, tanggal acuan dari periode", () => {
    expect(mapping).toMatchObject({ delimiter: ";", headerRow: 5, dateColumn: "Tanggal", dateFormat: "DD-MM-YYYY", debitColumn: "Mutasi Debet", creditColumn: "Mutasi Kredit" });
    expect(inspection.referenceDate).toBe("2026-08-31");
  });

  it("baris rusak dilewati dengan alasan, ringkasan dipisah", () => {
    expect(result.rows.map((r) => r.amount)).toEqual([500_000n, -350_000n, -1_000_000n]);
    const invalid = result.skipped.filter((s) => s.kind === "invalid");
    expect(invalid.map((s) => [s.line, s.reason])).toEqual([
      [9, 'Tanggal "32-08-2026" tidak cocok dengan format DD-MM-YYYY'],
      [11, 'Debit "12.34.5" tidak terbaca dengan pemisah desimal koma'],
    ]);
    expect(result.skipped.filter((s) => s.kind === "summary")).toHaveLength(3);
    expect(hasBlockingSkips(result.skipped)).toBe(true);
  });
});

describe("pemetaan", () => {
  it("kolom yang tidak ada di file melempar CsvMappingError", () => {
    const bytes = fixture("debit-kredit-id.csv");
    const mapping = { ...inspectCsv(bytes, TODAY).suggestion, dateColumn: "Tgl Posting" };
    expect(() => parseCsvTable(decodeTable(bytes, mapping), mapping, TODAY)).toThrow(CsvMappingError);
    expect(templateFits(mapping, inspectCsv(bytes, TODAY).columns)).toBe(false);
  });

  it("skema menolak pemetaan tanpa kolom nominal dan membuang debit/kredit di mode satu kolom", () => {
    const base = inspectCsv(fixture("nominal-bertanda.csv"), TODAY).suggestion;
    expect(csvMappingSchema.safeParse({ ...base, amountColumn: null }).success).toBe(false);
    const parsed = csvMappingSchema.parse({ ...base, debitColumn: "Saldo" });
    expect(parsed.debitColumn).toBeNull();
  });
});
