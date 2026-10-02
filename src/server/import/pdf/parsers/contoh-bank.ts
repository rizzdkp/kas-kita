import { parseAmount } from "@/lib/money";
import { parseDateKey } from "@/lib/dates";
import type { ParsedRow } from "../../types";
import type { StatementParser } from "../types";

// PARSER REFERENSI: format "Bank Contoh" adalah e-statement sintetis buatan tim, bukan format bank sungguhan.
// Daftar bank v1 menunggu O-1 (docs/prd/README.md). Parser ini menunjukkan kontrak StatementParser dan
// cara menambah parser baru (lihat docs/decisions/0008-parser-pdf-referensi.md).
//
// Tata letak yang dikenali (kolom dipisah minimal dua spasi oleh extract-text):
//   BANK CONTOH
//   REKENING KORAN ELEKTRONIK
//   TANGGAL  JAM  KETERANGAN  MUTASI  D/K  SALDO
//   01/08/2026  07:12  GAJI AGUSTUS  12.500.000,00  CR  17.500.000,00
//   (baris lanjutan keterangan tanpa tanggal)

const SLUG = "contoh-bank";

const ROW_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(?:(\d{2}):(\d{2})\s+)?(.+?)\s{2,}([\d.]+,\d{2})\s+(DB|CR)\s+(-?[\d.]+,\d{2})$/;
// baris di luar tabel yang tidak boleh ikut menjadi keterangan lanjutan
const SKIP_RE = /^(TANGGAL\s|SALDO AWAL|SALDO AKHIR|TOTAL |Halaman \d+ dari \d+|BANK CONTOH|REKENING KORAN|Nama:|No\. Rekening:|Periode:|Mata uang:)/;

export class ContohBankFormatError extends Error {
  override name = "ContohBankFormatError";
}

function toRupiah(text: string): bigint {
  const value = parseAmount(text);
  if (value === null) throw new ContohBankFormatError("nominal tidak terbaca");
  return value;
}

function parseLine(line: string, page: number): ParsedRow | null {
  const m = ROW_RE.exec(line);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, description, mutasi, dk, saldo] = m;
  const date = `${yyyy}-${mm}-${dd}`;
  if (!parseDateKey(date)) throw new ContohBankFormatError("tanggal tidak valid");
  const magnitude = toRupiah(mutasi!);
  if (magnitude <= 0n) throw new ContohBankFormatError("nominal nol");
  const raw: Record<string, string> = {
    tanggal: `${dd}/${mm}/${yyyy}`,
    jam: hh ? `${hh}:${mi}` : "",
    keterangan: description!.trim(),
    mutasi: mutasi!,
    dk: dk!,
    saldo: saldo!,
    halaman: String(page),
  };
  return {
    date,
    time: hh ? `${hh}:${mi}` : null,
    description: description!.trim(),
    amount: dk === "CR" ? magnitude : -magnitude,
    balance: toRupiah(saldo!),
    raw,
  };
}

export const contohBankParser: StatementParser = {
  slug: SLUG,
  canParse(text) {
    return /^BANK CONTOH$/m.test(text) && /^REKENING KORAN ELEKTRONIK$/m.test(text);
  },
  parse(pages) {
    const rows: ParsedRow[] = [];
    pages.forEach((text, index) => {
      let last: ParsedRow | null = null;
      let inTable = false;
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        if (/^TANGGAL\s/.test(line)) {
          inTable = true;
          continue;
        }
        if (!inTable) continue;
        if (/^(SALDO AKHIR|TOTAL |Halaman \d+ dari \d+)/.test(line)) {
          inTable = false;
          last = null;
          continue;
        }
        const row = parseLine(line, index + 1);
        if (row) {
          rows.push(row);
          last = row;
        } else if (last && !SKIP_RE.test(line)) {
          // keterangan panjang dipotong ke baris berikutnya tanpa tanggal
          last.description = `${last.description} ${line}`;
          last.raw.keterangan = last.description;
        }
      }
    });
    if (rows.length === 0) throw new ContohBankFormatError("tidak ada baris transaksi");
    return rows;
  },
};
