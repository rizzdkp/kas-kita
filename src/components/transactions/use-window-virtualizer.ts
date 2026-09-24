"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

/** Offset kumulatif; dipisah supaya bisa dites tanpa DOM. */
export function computeOffsets(sizes: readonly number[]): number[] {
  const offsets = new Array<number>(sizes.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < sizes.length; i++) offsets[i + 1] = offsets[i]! + sizes[i]!;
  return offsets;
}

/** Indeks item pertama yang berakhir setelah `y` (pencarian biner di offsets). */
export function findStartIndex(offsets: readonly number[], y: number): number {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1]! <= y) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo);
}

export function visibleRange(
  offsets: readonly number[],
  viewportTop: number,
  viewportHeight: number,
  overscanPx: number,
): { start: number; end: number } {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: -1 };
  const start = findStartIndex(offsets, Math.max(0, viewportTop - overscanPx));
  const bottom = viewportTop + viewportHeight + overscanPx;
  let end = start;
  while (end < count - 1 && offsets[end + 1]! < bottom) end++;
  return { start, end };
}

/**
 * Virtualisasi berbasis scroll window (halaman app menggulir dokumen, bukan kontainer).
 * Tinggi tiap item tetap dan diketahui, jadi tidak perlu mengukur DOM per baris.
 */
export function useWindowVirtualizer(sizes: readonly number[], overscanPx = 600) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const offsets = useMemo(() => computeOffsets(sizes), [sizes]);
  const [viewport, setViewport] = useState({ top: 0, height: 900 });

  const measure = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    const rectTop = node.getBoundingClientRect().top;
    setViewport((prev) => {
      const top = -rectTop;
      const height = window.innerHeight;
      return prev.top === top && prev.height === height ? prev : { top, height };
    });
  }, []);

  useLayoutEffect(measure, [measure, offsets]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [measure]);

  const { start, end } = visibleRange(offsets, viewport.top, viewport.height, overscanPx);
  const items: VirtualItem[] = [];
  for (let i = start; i <= end; i++) items.push({ index: i, start: offsets[i]!, size: sizes[i]! });

  return { containerRef, items, totalSize: offsets[offsets.length - 1] ?? 0, lastVisibleIndex: end };
}
