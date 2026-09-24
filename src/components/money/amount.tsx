import { formatCompact, formatRupiah, MINUS } from "@/lib/money";
import { cn } from "@/components/ui/cn";

export type AmountSize = "body" | "large" | "hero";
export type AmountSign = "negative" | "always" | "none";

export type AmountProps = {
  value: bigint;
  /** full: "Rp 1.250.000"; compact: "1,25 jt" untuk sumbu dan ruang sempit. */
  format?: "full" | "compact";
  /** negative: hanya "−" untuk negatif; always: "+" juga (daftar transaksi, delta); none: nilai mutlak. */
  sign?: AmountSign;
  size?: AmountSize;
  /** Warna hanya kalau angka butuh perhatian (DESIGN 2.1). */
  tone?: "default" | "attention";
  className?: string;
};

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function signText(value: bigint, sign: AmountSign): string {
  if (sign === "none" || value === 0n) return "";
  if (value < 0n) return MINUS;
  return sign === "always" ? "+" : "";
}

export function formatAmountText(value: bigint, format: "full" | "compact", sign: AmountSign): string {
  const body = format === "compact" ? formatCompact(abs(value)) : formatRupiah(abs(value));
  return signText(value, sign) + body;
}

const SIZE: Record<AmountSize, string> = {
  body: "",
  large: "text-large",
  hero: "text-hero-sm sm:text-hero",
};

/** Nominal rupiah, selalu angka tabular. Varian large dan hero menulis "Rp" setengah ukuran, rata atas. */
export function Amount({ value, format = "full", sign = "negative", size = "body", tone = "default", className }: AmountProps) {
  const text = formatAmountText(value, format, sign);
  const color = tone === "attention" ? "text-attention" : undefined;

  if (size === "body" || format === "compact") {
    return <span className={cn("tabular whitespace-nowrap", SIZE[size], color, className)}>{text}</span>;
  }

  const digits = formatRupiah(abs(value)).replace(/^Rp\s/, "");
  return (
    <span className={cn("tabular inline-flex items-start whitespace-nowrap", SIZE[size], color, className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex items-start">
        {signText(value, sign)}
        <span className={cn("text-[0.5em] font-medium leading-[1.45]", size === "hero" ? "mr-2" : "mr-1")}>Rp</span>
        {digits}
      </span>
    </span>
  );
}
