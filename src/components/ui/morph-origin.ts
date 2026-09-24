"use client";

import { useCallback, useRef, type MouseEvent } from "react";

type Point = { x: number; y: number };

/**
 * Sheet dan dialog tumbuh dari pemicunya (DESIGN 5.6). Pemicu mencatat titik tengahnya,
 * konten menghitung transform-origin relatif terhadap kotaknya sendiri saat terpasang.
 */
export function useMorphOrigin() {
  const origin = useRef<Point | null>(null);

  const captureTrigger = useCallback((event: MouseEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  const contentRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const point = origin.current;
    if (!point) {
      node.style.removeProperty("--origin-x");
      node.style.removeProperty("--origin-y");
      return;
    }
    // offset* mengabaikan transform animasi yang sedang berjalan; konten diposisikan fixed tanpa translate
    node.style.setProperty("--origin-x", `${point.x - node.offsetLeft}px`);
    node.style.setProperty("--origin-y", `${point.y - node.offsetTop}px`);
  }, []);

  return { captureTrigger, contentRef };
}
