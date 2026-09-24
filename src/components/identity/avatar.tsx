import type { CSSProperties } from "react";
import { cn } from "@/components/ui/cn";
import { identityColorVar, type IdentityColor } from "./identity-colors";

type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = {
  name: string;
  color: IdentityColor;
  size?: AvatarSize;
  /** Tampilkan nama ke pembaca layar; matikan kalau nama sudah tertulis di sebelahnya. */
  labelled?: boolean;
  className?: string;
};

const SIZE: Record<AvatarSize, string> = {
  sm: "size-6 text-caption",
  md: "size-8 text-small font-medium",
  lg: "size-10 text-control",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** Inisial dengan cincin warna identitas; tanpa foto supaya tidak ada aset yang diasumsikan. */
export function Avatar({ name, color, size = "md", labelled = true, className }: AvatarProps) {
  const style: CSSProperties = {
    boxShadow: `inset 0 0 0 2px ${identityColorVar(color)}, inset 0 0 0 3px var(--surface)`,
  };
  return (
    <span
      role={labelled ? "img" : undefined}
      aria-label={labelled ? name : undefined}
      aria-hidden={labelled ? undefined : true}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-pill bg-surface-sunken text-primary",
        SIZE[size],
        className,
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}
