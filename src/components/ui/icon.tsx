import type { LucideIcon, LucideProps } from "lucide-react";

// DESIGN 9: stroke 1,75px, 20px di kontrol, 16px di keterangan
export const ICON_STROKE = 1.75;

type IconProps = Omit<LucideProps, "ref"> & { icon: LucideIcon; size?: 16 | 20 | 24 };

export function Icon({ icon: Glyph, size = 20, ...rest }: IconProps) {
  return <Glyph aria-hidden size={size} strokeWidth={ICON_STROKE} absoluteStrokeWidth={false} {...rest} />;
}
