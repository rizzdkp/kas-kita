import type { CSSProperties, ReactNode } from "react";
import { Banknote, ChartLine, CreditCard, Gem, HandCoins, Landmark, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { ICON_STROKE } from "@/components/ui/icon";
import type { AccountType } from "@/server/db/schema";
import { accountGlyph, institutionMark, institutionMonogram, type AccountGlyph } from "./institutions";

const GLYPHS: Record<AccountGlyph, LucideIcon> = {
  cash: Banknote,
  investment: ChartLine,
  asset: Gem,
  card: CreditCard,
  loan: HandCoins,
  bank: Landmark,
  wallet: Wallet,
};

// monogram lewat ::before supaya tidak ikut textContent nama akun di sebelahnya (tes dan salin teks)
const MONO = "inline-flex items-center justify-center overflow-hidden whitespace-nowrap before:content-[attr(data-mono)]";

type InstitutionBadgeProps = {
  /** institutions.slug; null untuk akun tanpa institusi. */
  slug?: string | null;
  /** institutions.name; dipakai untuk monogram institusi yang belum dikenal. */
  name?: string | null;
  /** Jenis akun untuk ikon cadangan saat tidak ada institusi. */
  type?: AccountType | null;
  /** md 32px untuk baris akun, sm 20px di samping nama. */
  size?: "md" | "sm";
  /** Titik identitas di sudut kanan bawah. */
  children?: ReactNode;
  className?: string;
};

/** Lencana akun: monogram warna merek, monogram netral, atau ikon jenis akun. Dekoratif; nama akun selalu tampil di sebelahnya. */
export function InstitutionBadge({ slug, name, type, size = "md", children, className }: InstitutionBadgeProps) {
  const sm = size === "sm";
  const mark = institutionMark(slug);
  const box = sm ? "size-5" : "size-8";
  let face: ReactNode;
  if (mark) {
    const style: CSSProperties = {
      background: `var(--inst-${mark.token}-bg)`,
      color: `var(--inst-${mark.token}-fg)`,
      boxShadow: "inset 0 0 0 1px var(--badge-ring)",
    };
    face = (
      <span
        data-institution={mark.token}
        data-mono={sm ? mark.short : mark.label}
        className={cn(box, MONO, sm ? "rounded-xs text-monogram-sm" : "rounded-sm text-monogram")}
        style={style}
      />
    );
  } else if (name) {
    face = (
      <span
        data-mono={institutionMonogram(name)}
        className={cn(box, MONO, "bg-surface-sunken text-secondary shadow-[inset_0_0_0_1px_var(--border)]", sm ? "rounded-xs text-monogram-sm" : "rounded-sm text-monogram")}
      />
    );
  } else {
    const Glyph = GLYPHS[accountGlyph(type)];
    face = (
      <span className={cn(box, "inline-flex items-center justify-center rounded-pill bg-surface-sunken text-secondary shadow-[inset_0_0_0_1px_var(--border)]")}>
        <Glyph aria-hidden size={sm ? 12 : 16} strokeWidth={ICON_STROKE} />
      </span>
    );
  }
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span aria-hidden className="inline-flex">
        {face}
      </span>
      {children ? <span className="absolute -bottom-0.5 -right-0.5 inline-flex">{children}</span> : null}
    </span>
  );
}
