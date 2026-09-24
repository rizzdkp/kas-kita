"use client";

import type { ComponentPropsWithRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "./cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;

type PopoverContentProps = ComponentPropsWithRef<typeof PopoverPrimitive.Content>;

export function PopoverContent({ className, sideOffset = 8, collisionPadding = 12, children, ...rest }: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content asChild sideOffset={sideOffset} collisionPadding={collisionPadding} {...rest}>
        <GlassSurface
          variant="regular"
          className={cn("kk-pop z-50 w-72 max-w-[calc(100vw-24px)] p-4 text-small text-primary outline-none", className)}
        >
          {children}
        </GlassSurface>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
