import type { CSSProperties, ReactNode } from "react";
import { Asset3D } from "@/components/assets/asset-3d";
import type { Asset3DName } from "@/components/assets/asset-names";
import { cn } from "@/components/ui/cn";
import type { AccountType } from "@/server/db/schema";
import { accountGlyph, institutionLogo, institutionMark, institutionMonogram, type AccountGlyph } from "./institutions";

// jenis akun tanpa institusi: benda yang mewakili isinya
const GLYPH_ASSETS: Record<AccountGlyph, Asset3DName> = {
  cash: "purse",
  investment: "chart-increasing",
  asset: "gem-stone",
  card: "credit-card",
  loan: "money-with-wings",
  bank: "bank",
  wallet: "mobile-phone",
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

/** Lencana akun: logo merek di ubin putih, monogram warna merek, monogram netral, atau aset 3D jenis akun. Dekoratif; nama akun selalu tampil di sebelahnya. */
export function InstitutionBadge({ slug, name, type, size = "md", children, className }: InstitutionBadgeProps) {
  const sm = size === "sm";
  const mark = institutionMark(slug);
  const logo = institutionLogo(mark);
  const box = sm ? "size-5" : "size-8";
  let face: ReactNode;
  if (mark && logo) {
    // ubin putih di kedua mode supaya warna asli logo tetap benar di kanvas gelap
    face = (
      <span
        data-institution={mark.token}
        className={cn(box, "inline-flex items-center justify-center overflow-hidden bg-logo-tile shadow-[inset_0_0_0_1px_var(--logo-tile-ring)]", sm ? "rounded-xs p-px" : "rounded-sm p-0.5")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis kecil, tanpa optimizer */}
        <img src={logo} alt="" width={sm ? 18 : 28} height={sm ? 18 : 28} loading="lazy" decoding="async" draggable={false} className="size-full object-contain" />
      </span>
    );
  } else if (mark) {
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
    face = (
      <span data-account-glyph={accountGlyph(type)} className={cn(box, "inline-flex items-center justify-center rounded-pill bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border)]")}>
        <Asset3D name={GLYPH_ASSETS[accountGlyph(type)]} size={sm ? 14 : 22} />
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
