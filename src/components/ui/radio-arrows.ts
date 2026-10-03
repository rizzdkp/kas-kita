import type { KeyboardEvent } from "react";

const NEXT = ["ArrowRight", "ArrowDown"];
const PREV = ["ArrowLeft", "ArrowUp"];

/**
 * Radix RadioGroup memilih item lewat listener keydown di document, yang di App Router berjalan setelah
 * fokus sudah pindah, jadi panah hanya memindah fokus. Handler ini memilih item berikutnya secara eksplisit.
 */
export function selectWithArrows<V extends string>(
  event: KeyboardEvent,
  values: readonly V[],
  current: V,
  onSelect: (value: V) => void,
): void {
  const step = NEXT.includes(event.key) ? 1 : PREV.includes(event.key) ? -1 : 0;
  if (step === 0 || values.length === 0) return;
  const index = values.indexOf(current);
  const next = values[(index + step + values.length) % values.length];
  if (next !== undefined && next !== current) onSelect(next);
}
