"use client";

import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "./icon-button";
import { useMorphOrigin } from "./morph-origin";

type Morph = ReturnType<typeof useMorphOrigin>;

const MorphContext = createContext<Morph | null>(null);

export function useOverlayMorph(): Morph | null {
  return useContext(MorphContext);
}

/** Root bersama Dialog dan Sheet: Radix Dialog + pencatat titik pemicu untuk morph. */
export function OverlayRoot({ children, ...props }: DialogPrimitive.DialogProps & { children: ReactNode }) {
  const morph = useMorphOrigin();
  return (
    <MorphContext.Provider value={morph}>
      <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
    </MorphContext.Provider>
  );
}

export function OverlayTrigger({ onClick, ...rest }: ComponentPropsWithRef<typeof DialogPrimitive.Trigger>) {
  const morph = useOverlayMorph();
  return (
    <DialogPrimitive.Trigger
      onClick={(event) => {
        morph?.captureTrigger(event);
        onClick?.(event);
      }}
      {...rest}
    />
  );
}

export function OverlayScrim() {
  return <DialogPrimitive.Overlay className="kk-scrim fixed inset-0 z-40 bg-scrim" />;
}

export function OverlayClose() {
  return (
    <DialogPrimitive.Close asChild>
      <IconButton icon={X} label="Tutup" round className="-mr-2 -mt-2" />
    </DialogPrimitive.Close>
  );
}

export const OverlayTitle = DialogPrimitive.Title;
export const OverlayDescription = DialogPrimitive.Description;
export const OverlayContent = DialogPrimitive.Content;
export const OverlayPortal = DialogPrimitive.Portal;
export const OverlayCloseButton = DialogPrimitive.Close;
