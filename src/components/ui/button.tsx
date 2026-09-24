import type { ComponentPropsWithRef } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-border bg-surface-sunken text-primary hover:border-border-strong",
  ghost: "text-secondary hover:bg-surface-sunken hover:text-primary",
  danger: "border border-transparent bg-surface-sunken text-error hover:border-border",
};

export const buttonBase =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-card text-control " +
  "transition-[background-color,border-color,color,transform] duration-(--dur-fast) ease-(--ease-out) " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-(--disabled-opacity)";

/** Tinggi 40px, 44px di layar kecil supaya target sentuh cukup. Maksimal satu `primary` per layar. */
export function Button({
  variant = "secondary",
  icon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonBase, "h-11 px-4 sm:h-10", VARIANT[variant], className)}
      {...rest}
    >
      {loading ? <Icon icon={LoaderCircle} className="kk-spin" /> : icon ? <Icon icon={icon} /> : null}
      {children}
    </button>
  );
}

export function buttonClassName(variant: ButtonVariant = "secondary", className?: string): string {
  return cn(buttonBase, "h-11 px-4 sm:h-10", VARIANT[variant], className);
}
