/**
 * Uang di Kas Kita selalu bigint rupiah bulat. Tidak ada float di jalur parse maupun format.
 */

export const MINUS = "−";

// batas kolom bigint Postgres (int8)
export const MAX_AMOUNT = 9_223_372_036_854_775_807n;

const SUFFIX_MULTIPLIER: Record<string, bigint> = {
  k: 1_000n,
  rb: 1_000n,
  ribu: 1_000n,
  jt: 1_000_000n,
  juta: 1_000_000n,
  m: 1_000_000_000n,
  miliar: 1_000_000_000n,
  milyar: 1_000_000_000n,
  triliun: 1_000_000_000_000n,
};

const AMOUNT_RE = /^([\d.,]+)\s*([a-z]*)$/;

/** Membagi pembilang/penyebut dengan pembulatan setengah ke atas (nilai non-negatif). */
function divRoundHalfUp(num: bigint, den: bigint): bigint {
  const q = num / den;
  return (num % den) * 2n >= den ? q + 1n : q;
}

/** Memecah angka bergaya Indonesia menjadi digit bulat dan digit pecahan, atau null kalau ambigu. */
function splitNumber(num: string, hasSuffix: boolean): { int: string; frac: string } | null {
  const dots = (num.match(/\./g) ?? []).length;
  const commas = (num.match(/,/g) ?? []).length;

  if (dots === 0 && commas === 0) return /^\d+$/.test(num) ? { int: num, frac: "" } : null;

  if (commas > 1) return null;

  if (commas === 1) {
    const [intPart = "", frac = ""] = num.split(",");
    if (!/^\d+$/.test(frac)) return null;
    if (dots > 0) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
      return { int: intPart.replaceAll(".", ""), frac };
    }
    if (!/^\d+$/.test(intPart)) return null;
    // "25,000" tanpa sufiks bisa berarti 25 ribu (gaya Inggris) atau 25 rupiah, jadi ditolak
    if (!hasSuffix && frac.length === 3) return null;
    return { int: intPart, frac };
  }

  if (dots > 1) {
    return /^\d{1,3}(\.\d{3})+$/.test(num) ? { int: num.replaceAll(".", ""), frac: "" } : null;
  }

  const [intPart = "", tail = ""] = num.split(".");
  if (!/^\d+$/.test(intPart) || !/^\d+$/.test(tail)) return null;
  if (tail.length === 3) return { int: intPart + tail, frac: "" };
  return { int: intPart, frac: tail };
}

/**
 * Mengubah teks nominal ("25rb", "1,5jt", "Rp 25.000", "2M", "-25rb") menjadi rupiah bulat.
 * Titik + tepat 3 digit = ribuan, koma = desimal. Mengembalikan null untuk input tidak valid atau ambigu.
 */
export function parseAmount(input: string): bigint | null {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase().replaceAll(MINUS, "-").replace(/\s+/g, " ");
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  }
  s = s.replace(/^(rp\.?|idr)\s*/, "").replace(/,-$/, "");
  if (s.startsWith("-")) {
    if (negative) return null;
    negative = true;
    s = s.slice(1).trim();
  }

  const match = AMOUNT_RE.exec(s);
  if (!match) return null;
  const [, num = "", suffix = ""] = match;
  if (!/^\d/.test(num)) return null;
  const multiplier = suffix === "" ? 1n : SUFFIX_MULTIPLIER[suffix];
  if (multiplier === undefined) return null;

  const parts = splitNumber(num, suffix !== "");
  if (!parts) return null;
  if (parts.int.length + parts.frac.length > 30) return null;

  const scale = 10n ** BigInt(parts.frac.length);
  const value = divRoundHalfUp(BigInt(parts.int + parts.frac) * multiplier, scale);
  if (value > MAX_AMOUNT) return null;
  return negative && value !== 0n ? -value : value;
}

const groupFormatter = new Intl.NumberFormat("id-ID", { useGrouping: true, maximumFractionDigits: 0 });

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function groupDigits(v: bigint): string {
  return groupFormatter.format(v);
}

/** "Rp 1.250.000"; negatif "−Rp 25.000"; dengan sign: true positif menjadi "+Rp 8.500.000". */
export function formatRupiah(v: bigint, opts: { sign?: boolean } = {}): string {
  const body = `Rp ${groupDigits(abs(v))}`;
  if (v < 0n) return MINUS + body;
  if (opts.sign && v > 0n) return `+${body}`;
  return body;
}

const COMPACT_UNITS: Array<{ unit: bigint; label: string }> = [
  { unit: 1_000n, label: "rb" },
  { unit: 1_000_000n, label: "jt" },
  { unit: 1_000_000_000n, label: "M" },
];

/** Format ringkas untuk sumbu dan ruang sempit: "850 rb", "1,25 jt", "2,1 M", "0", "−5 jt". */
export function formatCompact(v: bigint): string {
  const a = abs(v);
  const sign = v < 0n ? MINUS : "";
  if (a < 1_000n) return sign + a.toString();

  let idx = COMPACT_UNITS.findLastIndex((u) => a >= u.unit);
  let hundredths = divRoundHalfUp(a * 100n, COMPACT_UNITS[idx]!.unit);
  // 999.995 rb dibulatkan jadi 1000 rb, lebih enak dibaca sebagai 1 jt
  if (hundredths >= 100_000n && idx < COMPACT_UNITS.length - 1) {
    idx += 1;
    hundredths = divRoundHalfUp(a * 100n, COMPACT_UNITS[idx]!.unit);
  }
  const intPart = hundredths / 100n;
  const frac = (hundredths % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  const numText = groupDigits(intPart) + (frac ? `,${frac}` : "");
  return `${sign}${numText} ${COMPACT_UNITS[idx]!.label}`;
}

const percentFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1, useGrouping: true });

/** Persen dalam satuan persen (30.84 -> "30,8%"). */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "";
  const text = percentFormatter.format(percent).replace("-", MINUS);
  return `${text === `${MINUS}0` ? "0" : text}%`;
}

/** Persentase part terhadap whole dalam satuan persen (0-100), null kalau whole 0. */
export function percentOf(part: bigint, whole: bigint): number | null {
  if (whole === 0n) return null;
  // presisi 4 desimal cukup untuk tampilan 1 desimal tanpa lewat float di pembagian
  const scaled = (part * 1_000_000n) / whole;
  return Number(scaled) / 10_000;
}

/**
 * Merapikan teks nominal saat diketik: "25000" -> "25.000", "25.0000" -> "250.000".
 * Input dengan sufiks (rb/jt/k), koma desimal, atau titik yang bukan pemisah ribuan dibiarkan.
 */
export function formatAmountInput(raw: string): string {
  const m = /^(\s*[-−]?\s*)((?:rp\.?|idr)\s*)?([\d.]*)(,\d*)?$/i.exec(raw);
  if (!m) return raw;
  const [, sign = "", prefix = "", digits = "", decimal = ""] = m;
  if (digits === "" || !/^\d+(\.\d{3,})*$/.test(digits)) return raw;
  const plain = digits.replaceAll(".", "").replace(/^0+(?=\d)/, "");
  return `${sign}${prefix}${groupDigits(BigInt(plain))}${decimal}`;
}

/** Konversi ke number untuk grafik di klien; melempar kalau melewati MAX_SAFE_INTEGER. */
export function toSafeNumber(v: bigint): number {
  if (abs(v) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Nominal terlalu besar untuk number");
  }
  return Number(v);
}

export type SerializedMoney = string;

/** bigint tidak bisa lewat JSON, jadi dikirim ke klien sebagai string desimal. */
export function serializeMoney(v: bigint): SerializedMoney {
  return v.toString();
}

export function deserializeMoney(s: SerializedMoney): bigint {
  if (typeof s !== "string" || !/^-?\d+$/.test(s)) {
    throw new TypeError("Format nominal tidak valid");
  }
  return BigInt(s);
}
