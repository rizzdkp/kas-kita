import type { QuickAddContextData } from "@/components/quick-add/types";
import { QUICK_ADD_SCHEMA_NAME } from "../schemas/quick-add";

export const QUICK_ADD_PROMPT_VERSION = "quick-add-v1";

const WEEKDAY = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface QuickAddPromptInput {
  ctx: QuickAddContextData;
  /** Hari ini di WIB, "YYYY-MM-DD". */
  today: string;
  /** 0 = Minggu, sama dengan Date.getDay() di WIB. */
  weekday: number;
  lines: string[];
}

function accountLines(ctx: QuickAddContextData): string {
  return ctx.accounts
    .map((a) => `- ${a.name} (${a.owner === "shared" ? "Bersama" : `milik ${a.ownerName ?? ""}`})`)
    .join("\n");
}

function categoryLines(ctx: QuickAddContextData, kind: "expense" | "income"): string {
  return ctx.categories
    .filter((c) => c.kind === kind)
    .map((c) => `- ${c.name}${c.parentName ? ` (bagian dari ${c.parentName})` : ""}`)
    .join("\n");
}

/** Prompt quick-add F-IN-2 AC2: model hanya membaca teks dan memilih dari daftar, tidak menghitung. */
export function buildQuickAddPrompt({ ctx, today, weekday, lines }: QuickAddPromptInput): { system: string; user: string } {
  const partner = ctx.partnerName ?? "(tidak ada)";
  const system = [
    "Kamu membaca catatan keuangan rumah tangga berbahasa Indonesia dan mengubah setiap baris menjadi field transaksi.",
    `schema: ${QUICK_ADD_SCHEMA_NAME}`,
    "",
    `Hari ini ${WEEKDAY[weekday] ?? ""}, ${today} (WIB).`,
    `Pencatat: ${ctx.meName}. Partner: ${partner}.`,
    "",
    "Akun yang boleh dipilih:",
    accountLines(ctx),
    "",
    "Kategori pengeluaran:",
    categoryLines(ctx, "expense"),
    "",
    "Kategori pemasukan:",
    categoryLines(ctx, "income"),
    "",
    "Aturan:",
    "- Kembalikan JSON {\"items\": [...]} dengan satu objek per baris input, field line berisi nomor baris.",
    "- kind: expense untuk pengeluaran, income untuk pemasukan, transfer untuk pindah uang antar akun sendiri.",
    "- amount: nominal rupiah sebagai bilangan bulat (175000) atau teks persis seperti tertulis (\"25rb\", \"1,5jt\"). Jangan menjumlah atau menghitung.",
    "- accountName dan toAccountName: salin persis nama dari daftar akun, hanya kalau baris menyebut akunnya; kalau tidak disebut isi null. toAccountName hanya untuk transfer.",
    "- categoryName: salin persis nama dari daftar kategori yang sesuai jenisnya. Kosongkan untuk transfer.",
    "- Kalau tidak yakin atau nama tidak ada di daftar, isi null. Jangan mengarang nama baru.",
    "- date: YYYY-MM-DD, atau null kalau baris tidak menyebut tanggal. Tanggal tidak boleh setelah hari ini.",
    "- note: keterangan singkat transaksi tanpa nominal dan nama akun, atau null.",
    `- beneficiary: writer kalau untuk ${ctx.meName} sendiri, partner kalau untuk ${partner}, shared kalau untuk bersama, null kalau tidak disebut.`,
  ].join("\n");
  const user = ["Baris input:", ...lines.map((line, i) => `${i + 1}. ${line}`)].join("\n");
  return { system, user };
}
