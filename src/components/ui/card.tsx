import type { ComponentPropsWithRef, ElementType } from "react";
import { cn } from "./cn";

type CardProps<T extends ElementType> = { as?: T; className?: string } & Omit<
  ComponentPropsWithRef<T>,
  "as" | "className"
>;

/** Kartu konten: solid, border 1px, radius 12, padding 20 (16 di layar kecil), tanpa bayangan. */
export function Card<T extends ElementType = "div">({ as, className, ...rest }: CardProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn("rounded-card border border-border bg-surface p-4 sm:p-(--space-card)", className)}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: ComponentPropsWithRef<"h3">) {
  return <h3 className={cn("text-card text-primary", className)} {...rest} />;
}
