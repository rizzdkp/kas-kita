import type { CSSProperties } from "react";
import { cn } from "@/components/ui/cn";
import { identityColorVar, type IdentityColor } from "./identity-colors";

type IdentityDotProps = {
  /** Pemilik tunggal. */
  color?: IdentityColor;
  /** Akun Bersama: dua setengah lingkaran warna kedua pengguna. */
  shared?: readonly [IdentityColor, IdentityColor];
  /** Teks untuk pembaca layar, misalnya "Milik Rizz". Tanpa label titik dianggap dekoratif. */
  label?: string;
  className?: string;
};

export function IdentityDot({ color, shared, label, className }: IdentityDotProps) {
  const background = shared
    ? `linear-gradient(90deg, ${identityColorVar(shared[0])} 50%, ${identityColorVar(shared[1])} 50%)`
    : identityColorVar(color ?? "slate");
  const style: CSSProperties = { background, boxShadow: "0 0 0 2px var(--surface)" };
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block size-2 shrink-0 rounded-pill", className)}
      style={style}
    />
  );
}
