"use client";

import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "./cn";
import {
  OverlayClose,
  OverlayCloseButton,
  OverlayContent,
  OverlayDescription,
  OverlayPortal,
  OverlayRoot,
  OverlayScrim,
  OverlayTitle,
  OverlayTrigger,
  useOverlayMorph,
} from "./overlay-context";

export const Sheet = OverlayRoot;
export const SheetTrigger = OverlayTrigger;
export const SheetClose = OverlayCloseButton;

type SheetContentProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Sheet: glass regular di atas scrim solid. Layar kecil: menempel di bawah; lebih lebar: panel kanan.
 * Tumbuh dari tombol pemicunya, bukan meluncur dari tepi.
 */
export function SheetContent({ title, description, children, className }: SheetContentProps) {
  const morph = useOverlayMorph();
  return (
    <OverlayPortal>
      <OverlayScrim />
      <OverlayContent asChild {...(description ? {} : { "aria-describedby": undefined })}>
        <GlassSurface
          ref={morph?.contentRef}
          variant="regular"
          className={cn(
            "kk-morph fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-4 outline-none",
            "sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[400px] sm:p-6",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <OverlayTitle className="text-section text-primary">{title}</OverlayTitle>
              {description ? (
                <OverlayDescription className="text-body text-secondary">{description}</OverlayDescription>
              ) : null}
            </div>
            <OverlayClose />
          </div>
          {children}
        </GlassSurface>
      </OverlayContent>
    </OverlayPortal>
  );
}
