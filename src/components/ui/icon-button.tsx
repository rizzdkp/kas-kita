import type { ComponentPropsWithRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { Icon } from "./icon";

type IconButtonVariant = "ghost" | "secondary";

export type IconButtonProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  icon: LucideIcon;
  /** Wajib: satu-satunya nama tombol untuk pembaca layar. */
  label: string;
  variant?: IconButtonVariant;
  /** Bentuk kapsul untuk tombol di dalam glass bar supaya radiusnya konsentris. */
  round?: boolean;
};

const VARIANT: Record<IconButtonVariant, string> = {
  ghost: "text-secondary hover:bg-surface-sunken hover:text-primary",
  secondary: "border border-border bg-surface-sunken text-primary hover:border-border-strong",
};

export function IconButton({
  icon,
  label,
  variant = "ghost",
  round = false,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center sm:size-10",
        round ? "rounded-pill" : "rounded-sm",
        "transition-colors duration-(--dur-fast) ease-(--ease-out)",
        "disabled:pointer-events-none disabled:opacity-(--disabled-opacity)",
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      <Icon icon={icon} />
    </button>
  );
}
