import type { ComponentPropsWithRef, ElementType } from "react";
import { cn } from "@/components/ui/cn";

export type GlassVariant = "bar" | "regular";

type OwnProps<T extends ElementType> = {
  as?: T;
  /** bar: sidebar, toolbar, tab bar, quick-add (radius 22). regular: sheet, dialog, toast, menu (radius 12). */
  variant?: GlassVariant;
  /** Membesar 1.02 dengan pegas saat ditekan. */
  pressable?: boolean;
  /** Toolbar: isian naik 8% saat konten di bawahnya di-scroll. */
  scrolled?: boolean;
  className?: string;
};

export type GlassSurfaceProps<T extends ElementType = "div"> = OwnProps<T> &
  Omit<ComponentPropsWithRef<T>, keyof OwnProps<T>>;

/** Satu-satunya pembuat glass di app. Isi CSS-nya ada di src/styles/glass.css. */
export function GlassSurface<T extends ElementType = "div">({
  as,
  variant = "bar",
  pressable = false,
  scrolled,
  className,
  ...rest
}: GlassSurfaceProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      data-glass={variant}
      data-scrolled={scrolled === undefined ? undefined : String(scrolled)}
      className={cn("glass", `glass--${variant}`, pressable && "glass--pressable", className)}
      {...rest}
    />
  );
}
