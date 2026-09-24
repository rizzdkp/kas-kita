"use client";

import type { ComponentPropsWithRef } from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "./cn";
import { Icon } from "./icon";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;

type ContentProps = ComponentPropsWithRef<typeof MenuPrimitive.Content>;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  collisionPadding = 12,
  align = "end",
  children,
  ...rest
}: ContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content asChild sideOffset={sideOffset} collisionPadding={collisionPadding} align={align} {...rest}>
        <GlassSurface variant="regular" className={cn("kk-pop z-50 min-w-52 p-1 outline-none", className)}>
          {children}
        </GlassSurface>
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

type ItemProps = ComponentPropsWithRef<typeof MenuPrimitive.Item> & { icon?: LucideIcon; tone?: "default" | "danger" };

export const menuItemClass =
  "flex h-11 cursor-default select-none items-center gap-3 rounded-md px-3 text-control outline-none sm:h-10 " +
  "data-highlighted:bg-glass-active data-disabled:opacity-(--disabled-opacity)";

export function DropdownMenuItem({ icon, tone = "default", className, children, ...rest }: ItemProps) {
  return (
    <MenuPrimitive.Item
      className={cn(menuItemClass, tone === "danger" ? "text-error" : "text-primary", className)}
      {...rest}
    >
      {icon ? <Icon icon={icon} className={tone === "danger" ? undefined : "text-secondary"} /> : null}
      {children}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({ className, ...rest }: ComponentPropsWithRef<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-3 pb-1 pt-2 text-small text-secondary", className)} {...rest} />;
}

export function DropdownMenuSeparator({ className, ...rest }: ComponentPropsWithRef<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("mx-2 my-1 h-px bg-border", className)} {...rest} />;
}
