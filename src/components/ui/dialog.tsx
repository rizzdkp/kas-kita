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

export const Dialog = OverlayRoot;
export const DialogTrigger = OverlayTrigger;
export const DialogClose = OverlayCloseButton;

type DialogContentProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Tombol aksi, rata kanan di bawah. */
  footer?: ReactNode;
  className?: string;
};

/** Dialog: glass regular di atas scrim solid, di tengah layar, tumbuh dari pemicunya. */
export function DialogContent({ title, description, children, footer, className }: DialogContentProps) {
  const morph = useOverlayMorph();
  return (
    <OverlayPortal>
      <OverlayScrim />
      <OverlayContent asChild {...(description ? {} : { "aria-describedby": undefined })}>
        <GlassSurface
          ref={morph?.contentRef}
          variant="regular"
          className={cn(
            "kk-morph fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] flex-col gap-4 overflow-y-auto p-6 outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <OverlayTitle className="text-section text-primary">{title}</OverlayTitle>
              {description ? (
                <OverlayDescription className="text-body text-primary">{description}</OverlayDescription>
              ) : null}
            </div>
            <OverlayClose />
          </div>
          {children}
          {footer ? <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div> : null}
        </GlassSurface>
      </OverlayContent>
    </OverlayPortal>
  );
}
