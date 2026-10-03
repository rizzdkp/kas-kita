import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Clock, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type BadgeTone = "neutral" | "positive" | "attention" | "due-soon" | "error";

const TONE: Record<BadgeTone, { className: string; icon: LucideIcon | null }> = {
  neutral: { className: "bg-surface-sunken text-secondary", icon: null },
  positive: { className: "bg-positive/10 text-positive", icon: CircleCheck },
  attention: { className: "bg-attention/10 text-attention", icon: CircleAlert },
  "due-soon": { className: "bg-due-soon/10 text-due-soon", icon: Clock },
  error: { className: "bg-error/10 text-error", icon: TriangleAlert },
};

type BadgeProps = {
  tone?: BadgeTone;
  /** Ganti ikon bawaan tone; status tidak pernah hanya dibawa warna. */
  icon?: LucideIcon | null;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  const glyph = icon === undefined ? TONE[tone].icon : icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs px-2 text-caption font-medium",
        TONE[tone].className,
      )}
    >
      {glyph ? <Icon icon={glyph} size={16} /> : null}
      <span className={className}>{children}</span>
    </span>
  );
}
