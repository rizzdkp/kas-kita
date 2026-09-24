"use client";

import { useEffect, useRef } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import type { Scope } from "@/lib/scope";
import { cn } from "@/components/ui/cn";
import { REDUCED_FADE, SPRING_GLASS } from "@/styles/motion";
import { selectWithArrows } from "@/components/ui/radio-arrows";
import { GlassSurface } from "./glass-surface";

const ORDER: readonly Scope[] = ["me", "partner", "all"];

type ScopeToggleProps = {
  value: Scope;
  onChange: (scope: Scope) => void;
  /** Nama tampilan partner; label tengah tidak pernah berbunyi "Partner" (F-SCOPE-1 AC2). */
  partnerName: string;
  /** Bungkus dengan glass sendiri. Matikan saat sudah berada di dalam toolbar glass (tanpa glass di atas glass). */
  standalone?: boolean;
  className?: string;
};

function isScope(value: string): value is Scope {
  return (ORDER as readonly string[]).includes(value);
}

/**
 * Toggle cakupan Saya / [partner] / Gabungan. Radiogroup dengan navigasi panah dari Radix.
 * Indikator kapsul meluncur dengan pegas dan meregang ke arah gerak; satu-satunya momen "cair".
 */
export function ScopeToggle({ value, onChange, partnerName, standalone = false, className }: ScopeToggleProps) {
  const reduced = useReducedMotion() ?? false;
  const index = Math.max(0, ORDER.indexOf(value));
  const previous = useRef(index);
  const [pillScope, animatePill] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    const from = previous.current;
    previous.current = index;
    if (from === index || !pillScope.current) return;
    if (reduced) {
      animatePill(pillScope.current, { opacity: [0, 1] }, REDUCED_FADE);
      return;
    }
    pillScope.current.style.transformOrigin = index > from ? "left center" : "right center";
    animatePill(pillScope.current, { scaleX: [1, 1.08, 1] }, { duration: 0.36, times: [0, 0.35, 1], ease: "easeOut" });
  }, [index, reduced, animatePill, pillScope]);

  const labels: Record<Scope, string> = { me: "Saya", partner: partnerName, all: "Gabungan" };

  const group = (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => {
        if (isScope(next)) onChange(next);
      }}
      onKeyDownCapture={(event) => selectWithArrows(event, ORDER, value, onChange)}
      aria-label="Cakupan"
      orientation="horizontal"
      loop
      className={cn(
        // kolom sama lebar mengikuti label terpanjang; dalam wadah sempit label terpotong
        "relative grid h-11 w-fit max-w-full grid-cols-[repeat(3,minmax(0,1fr))] rounded-pill p-1",
        standalone ? "" : "bg-surface-sunken",
        className,
      )}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: `${index * 100}%` }}
        transition={reduced ? { duration: 0 } : SPRING_GLASS}
        className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)]"
      >
        <span ref={pillScope} className="glass-active block size-full rounded-pill" />
      </motion.span>
      {ORDER.map((scope) => (
        <RadioGroup.Item
          key={scope}
          value={scope}
          className={cn(
            "relative z-10 min-w-0 truncate rounded-pill px-2 text-control sm:px-4",
            "transition-colors duration-(--dur-fast) ease-(--ease-out)",
            "text-secondary hover:text-primary data-[state=checked]:text-primary",
          )}
        >
          {labels[scope]}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );

  if (!standalone) return group;
  return (
    <GlassSurface variant="bar" className="p-0">
      {group}
    </GlassSurface>
  );
}
