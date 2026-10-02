import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writePdf, type PdfText } from "./pdf-writer";

// Generator fixture PDF anonim untuk parser referensi "contoh-bank" (format sintetis, bukan bank sungguhan).
// Jalankan: npx tsx tests/fixtures/statements/generate.ts

const here = dirname(fileURLToPath(import.meta.url));
export const CONTOH_BANK_PASSWORD = "contoh123";

interface Row {
  date: string;
  time: string | null;
  lines: string[];
  amount: number;
  saldo?: number;
}

const OPENING = 5_000_000;
const ROWS: Row[] = [
  { date: "01/08/2026", time: "07:12", lines: ["GAJI AGUSTUS 2026", "PT CONTOH SEJAHTERA"], amount: 12_500_000 },
  { date: "02/08/2026", time: "12:30", lines: ["QRIS WARUNG MAKAN SEDERHANA"], amount: -45_000 },
  { date: "03/08/2026", time: null, lines: ["BIAYA ADMINISTRASI"], amount: -15_000 },
  { date: "05/08/2026", time: "19:05", lines: ["TRANSFER KE REKENING TABUNGAN", "TARGET DANA DARURAT"], amount: -2_000_000 },
  { date: "07/08/2026", time: "08:40", lines: ["PEMBAYARAN LISTRIK PRABAYAR"], amount: -250_000 },
  { date: "10/08/2026", time: "21:15", lines: ["TOP UP DOMPET DIGITAL"], amount: -300_000 },
  { date: "12/08/2026", time: "10:00", lines: ["BELANJA SUPERMARKET CONTOH"], amount: -612_450 },
  { date: "15/08/2026", time: "16:20", lines: ["TRANSFER MASUK DARI PARTNER"], amount: 750_000 },
  { date: "18/08/2026", time: "09:10", lines: ["CICILAN KARTU KREDIT"], amount: -1_200_000 },
  { date: "20/08/2026", time: "13:45", lines: ["QRIS KEDAI KOPI"], amount: -38_000 },
  { date: "22/08/2026", time: "11:11", lines: ["BUNGA TABUNGAN"], amount: 1_234 },
  { date: "25/08/2026", time: "18:30", lines: ["BELANJA DARING TOKO CONTOH", "PESANAN 000123"], amount: -189_900 },
  { date: "28/08/2026", time: "07:55", lines: ["PAJAK BUNGA"], amount: -247 },
];
const ROWS_PER_PAGE = 8;

// lebar glyph Helvetica per 1000 unit, cukup untuk rata kanan angka
const WIDTH: Record<string, number> = { ".": 278, ",": 278, "-": 333 };
function textWidth(s: string, size: number): number {
  return [...s].reduce((w, c) => w + (WIDTH[c] ?? 556), 0) * (size / 1000);
}

function idr(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${digits},00`;
}

function right(xEnd: number, y: number, text: string, size = 8): PdfText {
  return { x: Math.round((xEnd - textWidth(text, size)) * 100) / 100, y, text, size };
}

function header(page: number, pages: number): PdfText[] {
  return [
    { x: 40, y: 790, text: "BANK CONTOH", size: 14, bold: true },
    { x: 40, y: 772, text: "REKENING KORAN ELEKTRONIK", size: 10, bold: true },
    { x: 40, y: 750, text: "Nama: PEMILIK REKENING CONTOH", size: 8 },
    { x: 40, y: 738, text: "No. Rekening: 0000-00-0000-0", size: 8 },
    { x: 40, y: 726, text: "Periode: 01/08/2026 s/d 31/08/2026", size: 8 },
    { x: 40, y: 714, text: "Mata uang: IDR", size: 8 },
    { x: 40, y: 690, text: "TANGGAL", size: 8, bold: true },
    { x: 100, y: 690, text: "JAM", size: 8, bold: true },
    { x: 135, y: 690, text: "KETERANGAN", size: 8, bold: true },
    { x: 380, y: 690, text: "MUTASI", size: 8, bold: true },
    { x: 440, y: 690, text: "D/K", size: 8, bold: true },
    { x: 525, y: 690, text: "SALDO", size: 8, bold: true },
    { x: 40, y: 40, text: `Halaman ${page} dari ${pages}`, size: 7 },
  ];
}

export function buildContohBankPages(opts: { corruptSaldoIndex?: number } = {}): PdfText[][] {
  let saldo = OPENING;
  const rows = ROWS.map((r, i) => {
    saldo += r.amount;
    const printed = i === opts.corruptSaldoIndex ? saldo - 50 : saldo;
    return { ...r, saldo: printed };
  });
  const pageCount = Math.ceil(rows.length / ROWS_PER_PAGE);
  const pages: PdfText[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const items = header(p + 1, pageCount);
    let y = 674;
    if (p === 0) {
      items.push({ x: 135, y, text: "SALDO AWAL", size: 8 }, right(555, y, idr(OPENING)));
      y -= 14;
    }
    for (const r of rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE)) {
      items.push({ x: 40, y, text: r.date, size: 8 });
      if (r.time) items.push({ x: 100, y, text: r.time, size: 8 });
      items.push({ x: 135, y, text: r.lines[0]!, size: 8 });
      items.push(right(420, y, idr(Math.abs(r.amount))));
      items.push({ x: 440, y, text: r.amount < 0 ? "DB" : "CR", size: 8 });
      items.push(right(555, y, idr(r.saldo)));
      for (const extra of r.lines.slice(1)) {
        y -= 11;
        items.push({ x: 135, y, text: extra, size: 8 });
      }
      y -= 14;
    }
    if (p === pageCount - 1) {
      const debit = ROWS.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
      const credit = ROWS.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
      y -= 6;
      items.push({ x: 135, y, text: "SALDO AKHIR", size: 8, bold: true }, right(555, y, idr(saldo)));
      y -= 14;
      items.push({ x: 135, y, text: "TOTAL DEBIT", size: 8 }, right(420, y, idr(debit)));
      y -= 12;
      items.push({ x: 135, y, text: "TOTAL KREDIT", size: 8 }, right(420, y, idr(credit)));
    }
    pages.push(items);
  }
  return pages;
}

function buildUnknownPages(): PdfText[][] {
  const lines = [
    "DOMPET CONTOH",
    "Riwayat transaksi 1 - 31 Agustus 2026",
    "",
    "2026-08-03  Pembayaran merchant KEDAI CONTOH  -Rp27.500",
    "2026-08-09  Isi saldo dari rekening  +Rp300.000",
    "2026-08-14  Kirim ke teman  -Rp50.000",
  ];
  const items: PdfText[] = [];
  lines.forEach((line, i) => {
    let x = 50;
    for (const cell of line.split("  ")) {
      if (cell) items.push({ x, y: 780 - i * 16, text: cell, size: 9 });
      x += cell.length * 5.5 + 30;
    }
  });
  return [items];
}

export function generateAll(outDir: string = here): Record<string, Buffer> {
  const files: Record<string, Buffer> = {
    "contoh-bank/mutasi-agustus.pdf": writePdf(buildContohBankPages(), { idSeed: "contoh-bank-agustus" }),
    "contoh-bank/mutasi-agustus-berpassword.pdf": writePdf(buildContohBankPages(), {
      idSeed: "contoh-bank-agustus-password",
      userPassword: CONTOH_BANK_PASSWORD,
    }),
    // saldo baris BELANJA SUPERMARKET dicetak Rp 50 lebih kecil untuk uji verifikasi saldo berjalan
    "contoh-bank/mutasi-agustus-saldo-selisih.pdf": writePdf(buildContohBankPages({ corruptSaldoIndex: 6 }), {
      idSeed: "contoh-bank-agustus-selisih",
    }),
    "tidak-dikenal/dompet-contoh.pdf": writePdf(buildUnknownPages(), { idSeed: "dompet-contoh" }),
  };
  for (const [name, data] of Object.entries(files)) {
    const path = join(outDir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = generateAll();
  for (const [name, data] of Object.entries(files)) console.log(`${name} (${data.length} byte)`);
}
