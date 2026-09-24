"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { DUR_HERO_COUNT_MS } from "@/styles/motion";
import { Amount, type AmountSign } from "./amount";

type HeroNumberProps = {
  value: bigint;
  sign?: AmountSign;
  tone?: "default" | "attention";
  className?: string;
};

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Angka hero: satu per layar, tanpa kartu. Hitung naik 400ms dari nilai sebelumnya hanya kalau nilainya
 * berubah; tidak beranimasi saat pertama tampil atau dengan prefers-reduced-motion.
 */
export function HeroNumber({ value, sign = "negative", tone = "default", className }: HeroNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;
    const inSafeRange = from <= SAFE && from >= -SAFE && value <= SAFE && value >= -SAFE;
    if (reduced || !inSafeRange) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = Number(from);
    const b = Number(value);
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUR_HERO_COUNT_MS);
      setShown(t >= 1 ? value : BigInt(Math.round(a + (b - a) * easeOut(t))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <p className={className}>
      <Amount value={shown} size="hero" sign={sign} tone={tone} />
    </p>
  );
}
