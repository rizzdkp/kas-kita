import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText, itemsToText, looksLikePdf } from "@/server/import/pdf/extract-text";
import { CONTOH_BANK_PASSWORD } from "../fixtures/statements/generate";

const locked = readFileSync(join(process.cwd(), "tests/fixtures/statements/contoh-bank/mutasi-agustus-berpassword.pdf"));

const item = (str: string, x: number, y: number, width = str.length * 5, size = 9) => ({ str, transform: [size, 0, 0, size, x, y], width, height: size });

describe("itemsToText", () => {
  it("mengurutkan baris dari atas ke bawah lalu kiri ke kanan, kolom jauh dipisah dua spasi", () => {
    const text = itemsToText([
      item("SALDO", 500, 700),
      item("TANGGAL", 40, 700),
      item("01/08/2026", 40, 686),
      item("GAJI", 135, 686.4),
    ]);
    expect(text).toBe("TANGGAL  SALDO\n01/08/2026  GAJI");
  });

  it("item berdempetan digabung tanpa spasi, celah kecil jadi satu spasi, item kosong dibuang", () => {
    const text = itemsToText([item("Rp", 10, 100, 10), item("25.000", 20, 100, 30), item(" ", 50, 100, 2), item("DB", 53, 100, 10)]);
    expect(text).toBe("Rp25.000 DB");
  });
});

describe("looksLikePdf", () => {
  it("mengecek magic %PDF- di awal file, bukan nama atau tipe", () => {
    expect(looksLikePdf(Buffer.from("%PDF-1.7\n..."))).toBe(true);
    expect(looksLikePdf(Buffer.from("\n\n%PDF-1.4"))).toBe(true);
    expect(looksLikePdf(Buffer.from("tanggal,keterangan,nominal"))).toBe(false);
    expect(looksLikePdf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });
});

describe("extractPdfText dengan password (F-IN-5 AC2)", () => {
  it("tanpa password: minta password, bukan password salah", async () => {
    expect(await extractPdfText(locked)).toEqual({ kind: "needs_password", wrongPassword: false });
  });

  it("password salah: wrongPassword true", async () => {
    expect(await extractPdfText(locked, "bukan-ini")).toEqual({ kind: "needs_password", wrongPassword: true });
  });

  it("password benar: teks terbaca dan buffer pemanggil tidak dipindahkan ke worker pdfjs", async () => {
    const bytes = new Uint8Array(locked);
    const out = await extractPdfText(bytes, CONTOH_BANK_PASSWORD);
    expect(out.kind).toBe("ok");
    expect(bytes.byteLength).toBe(locked.length);
    if (out.kind === "ok") expect(out.pages[0]).toContain("BANK CONTOH");
  });

  it("file rusak berawalan %PDF- menjadi invalid, bukan error tak tertangkap", async () => {
    expect(await extractPdfText(Buffer.from("%PDF-1.4\nrusak total"))).toEqual({ kind: "invalid" });
  });
});
