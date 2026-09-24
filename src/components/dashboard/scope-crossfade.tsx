"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { REDUCED_FADE } from "@/styles/motion";

/** Crossfade 120ms saat cakupan berganti (UX-FLOWS bagian 7); tidak ada animasi saat halaman pertama dimuat. */
export function ScopeCrossfade({ scope, children }: { scope: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(scope);
  useEffect(() => {
    if (previous.current === scope) return;
    previous.current = scope;
    ref.current?.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: REDUCED_FADE.duration * 1000, easing: "linear" });
  }, [scope]);
  return (
    <div ref={ref} className="flex flex-col gap-4 sm:gap-6">
      {children}
    </div>
  );
}
