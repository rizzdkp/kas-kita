import type { AccountType } from "@/server/db/schema";

/** Lencana institusi: logo dari idn-finlogos bila ada (docs/decisions/0016), monogram warna merek --inst-* sebagai cadangan (0012). */
export interface InstitutionMark {
  /** Monogram di lencana 32px, maksimal 4 huruf. */
  label: string;
  /** Monogram di lencana 20px, maksimal 2 huruf; tiga huruf terpotong di kotak sekecil itu. */
  short: string;
  /** Kunci token warna: --inst-<token>-bg dan --inst-<token>-fg. */
  token: string;
}

const MARKS: Record<string, InstitutionMark> = {
  bca: { label: "BCA", short: "B", token: "bca" },
  jago: { label: "Jago", short: "J", token: "jago" },
  gopay: { label: "GP", short: "GP", token: "gopay" },
  ovo: { label: "OVO", short: "O", token: "ovo" },
  mandiri: { label: "mdr", short: "m", token: "mandiri" },
  bri: { label: "BRI", short: "BR", token: "bri" },
  bni: { label: "BNI", short: "BN", token: "bni" },
  dana: { label: "DANA", short: "D", token: "dana" },
  shopeepay: { label: "SP", short: "SP", token: "shopeepay" },
  seabank: { label: "Sea", short: "S", token: "seabank" },
  jenius: { label: "Jen", short: "J", token: "jenius" },
  blu: { label: "blu", short: "b", token: "blu" },
  cimb: { label: "CIMB", short: "C", token: "cimb" },
  permata: { label: "PB", short: "P", token: "permata" },
};

// slug di DB bisa memakai nama panjang; semua dipetakan ke satu tanda
const ALIASES: Record<string, string> = {
  "bank-jago": "jago",
  "bank-mandiri": "mandiri",
  "bank-bri": "bri",
  "bank-bni": "bni",
  "shopee-pay": "shopeepay",
  spay: "shopeepay",
  "sea-bank": "seabank",
  "cimb-niaga": "cimb",
  "blu-bca": "blu",
  "bca-digital": "blu",
  "permata-bank": "permata",
  permatabank: "permata",
};

// berkas di public/brands/<token>.svg, disalin dari idn-finlogos 2.5.0 (CC BY-NC 4.0)
const LOGOS = new Set(["bca", "jago", "gopay", "ovo", "mandiri", "bri", "bni", "dana", "shopeepay", "seabank", "jenius", "blu", "cimb", "permata"]);

/** Path logo merek untuk tanda institusi; null bila belum ada logo dan monogram dipakai. */
export function institutionLogo(mark: InstitutionMark | null): string | null {
  return mark && LOGOS.has(mark.token) ? `/brands/${mark.token}.svg` : null;
}

export function institutionMark(slug: string | null | undefined): InstitutionMark | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase();
  return MARKS[key] ?? MARKS[ALIASES[key] ?? ""] ?? null;
}

/** Dua huruf dari nama institusi yang tidak dikenal: "Bank Neo" -> "BN", "Flip" -> "Fl". */
export function institutionMonogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const w = words[0]!;
    return w.length <= 2 ? w.toUpperCase() : w[0]!.toUpperCase() + w[1]!.toLowerCase();
  }
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Jenis akun yang wajar tanpa institusi memakai ikon jenis, bukan monogram. */
export type AccountGlyph = "cash" | "investment" | "asset" | "card" | "loan" | "bank" | "wallet";

export function accountGlyph(type: AccountType | null | undefined): AccountGlyph {
  switch (type) {
    case "cash":
      return "cash";
    case "investment":
      return "investment";
    case "credit_card":
    case "paylater":
      return "card";
    case "loan":
      return "loan";
    case "bank":
      return "bank";
    case "ewallet":
      return "wallet";
    default:
      return "asset";
  }
}
