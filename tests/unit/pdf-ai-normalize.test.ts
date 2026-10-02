import { describe, expect, it } from "vitest";
import { buildPdfExtractPrompt } from "@/server/ai/prompts/pdf-extract-v1";
import { normalizePdfAiRows, pdfExtractAiJsonSchema, pdfExtractAiSchema, toSignedRupiah } from "@/server/ai/schemas/pdf-extract";
import { chunkPages } from "@/server/import/pdf/chunk-pages";

const TODAY = "2026-09-24";
const normalize = (rows: unknown[]) => normalizePdfAiRows(pdfExtractAiSchema.parse({ rows }), { today: TODAY, page: 2 });

describe("toSignedRupiah", () => {
  it.each([
    ["-45.000,00", -45_000n],
    ["45.000,00", 45_000n],
    ["+Rp300.000", 300_000n],
    ["-Rp27.500", -27_500n],
    ["612.450,00 DB", -612_450n],
    ["750.000,00 CR", 750_000n],
    ["1.234 K", 1_234n],
    ["(15.000)", -15_000n],
    [-50000, -50_000n],
    [12.6, 13n],
  ] as const)("%s → %s", (input, expected) => {
    expect(toSignedRupiah(input)).toBe(expected);
  });

  it("teks bukan nominal dan angka di luar batas aman menjadi null", () => {
    expect(toSignedRupiah("dua puluh")).toBeNull();
    expect(toSignedRupiah(Number.MAX_SAFE_INTEGER * 4)).toBeNull();
    expect(toSignedRupiah(null)).toBeNull();
  });
});

describe("normalizePdfAiRows", () => {
  it("baris valid menjadi ParsedRow dengan raw asli dan nomor halaman", () => {
    const out = normalize([{ date: "2026-08-03", time: "9.05", description: "  QRIS   KEDAI ", amount: "-27.500", balance: "1.000.000,00" }]);
    expect(out.rejected).toBe(0);
    expect(out.rows).toEqual([
      {
        date: "2026-08-03",
        time: "09:05",
        description: "QRIS KEDAI",
        amount: -27_500n,
        balance: 1_000_000n,
        raw: { tanggal: "2026-08-03", jam: "9.05", keterangan: "  QRIS   KEDAI ", nominal: "-27.500", saldo: "1.000.000,00", halaman: "2" },
      },
    ]);
  });

  it("tanggal DD/MM/YYYY diterima; tanggal masa depan, tanggal mustahil, nominal nol, dan keterangan kosong ditolak", () => {
    const out = normalize([
      { date: "14/08/2026", time: null, description: "Kirim", amount: -50000, balance: null },
      { date: "2026-09-25", time: null, description: "Besok", amount: -1000, balance: null },
      { date: "2026-02-30", time: null, description: "Mustahil", amount: -1000, balance: null },
      { date: "2026-08-01", time: null, description: "Nol", amount: "0", balance: null },
      { date: "2026-08-01", time: null, description: "  ", amount: -1000, balance: null },
      { date: "2026-08-01", time: null, description: "Tanpa nominal", amount: null, balance: null },
    ]);
    expect(out.rows.map((r) => r.date)).toEqual(["2026-08-14"]);
    expect(out.rejected).toBe(5);
  });

  it("baris berbentuk salah dari model tidak menggagalkan seluruh jawaban", () => {
    const out = normalize(["rusak", 42, { date: "2026-08-02", description: "Ok", amount: 5000 }]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ time: null, balance: null, amount: 5_000n });
    expect(out.rejected).toBe(2);
  });

  it("skema ketat untuk server: semua field wajib di setiap baris", () => {
    const rows = (pdfExtractAiJsonSchema.properties as { rows: { items: { required: string[] } } }).rows;
    expect(rows.items.required.sort()).toEqual(["amount", "balance", "date", "description", "time"]);
  });
});

describe("chunkPages", () => {
  it("satu potongan per halaman, halaman kosong dilewati, halaman panjang dipecah per baris", () => {
    const long = Array.from({ length: 10 }, (_, i) => `baris ${i} ${"x".repeat(20)}`).join("\n");
    const chunks = chunkPages(["hal satu", "  ", long], 100);
    expect(chunks[0]).toEqual({ page: 1, text: "hal satu" });
    expect(chunks.slice(1).every((c) => c.page === 3 && c.text.length <= 100)).toBe(true);
    expect(chunks.slice(1).map((c) => c.text).join("\n")).toBe(long);
  });
});

describe("prompt pdf-extract-v1", () => {
  it("memuat nama skema untuk fallback, tanggal hari ini, dan teks halaman dibatasi penanda", () => {
    const p = buildPdfExtractPrompt({ today: TODAY, pageText: "ISI", page: 1, pageCount: 3 });
    expect(p.system).toContain("schema: pdf_extract");
    expect(p.system).toContain(TODAY);
    expect(p.user).toBe("Halaman 1 dari 3:\n<<<\nISI\n>>>");
  });
});
