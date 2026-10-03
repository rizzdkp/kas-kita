import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { ICON_STROKE } from "@/components/ui/icon";
import { categoryIcon } from "@/components/transactions/category-icon";
import { categoryTone, toneVars, type CategoryTone, type CategoryToneInput } from "./category-tones";

type CategoryIconProps = CategoryToneInput & {
  /** Nada yang sudah dihitung pemanggil; bawaan dari categoryTone(props). */
  tone?: CategoryTone;
  /** md 32px untuk baris transaksi, sm 20px di samping label. */
  size?: "md" | "sm";
  /** Titik identitas di sudut kanan bawah. */
  children?: ReactNode;
  className?: string;
};

/** Ikon kategori berwarna dalam lingkaran tint; dekoratif karena nama kategori selalu tampil sebagai teks. */
export function CategoryIcon({ tone, size = "md", children, className, ...input }: CategoryIconProps) {
  const Glyph = categoryIcon(input.icon);
  const resolved = tone ?? categoryTone(input);
  const sm = size === "sm";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        aria-hidden
        data-tone={resolved}
        className={cn("inline-flex items-center justify-center rounded-pill", sm ? "size-5" : "size-8")}
        style={toneVars(resolved)}
      >
        <Glyph size={sm ? 12 : 16} strokeWidth={ICON_STROKE} />
      </span>
      {children ? <span className="absolute -bottom-0.5 -right-0.5 inline-flex">{children}</span> : null}
    </span>
  );
}
