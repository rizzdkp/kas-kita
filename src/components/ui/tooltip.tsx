"use client";

import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "./cn";

export const TooltipProvider = TooltipPrimitive.Provider;

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Matikan tooltip tanpa mengubah struktur, misalnya saat label sudah terlihat. */
  disabled?: boolean;
  /** Misalnya "lg:hidden" untuk tooltip rail yang labelnya terlihat di layar besar. */
  contentClassName?: string;
};

/** Tooltip melengkapi label yang sudah ada (aria-label); jangan jadikan satu-satunya sumber info. */
export function Tooltip({ content, children, side = "top", disabled = false, contentClassName }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content asChild side={side} sideOffset={8} collisionPadding={12}>
          <GlassSurface variant="regular" className={cn("kk-pop z-50 px-3 py-2 text-control text-primary", contentClassName)}>
            {content}
          </GlassSurface>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
