import { formatCountdown } from "@/lib/dates";
import type { Scope } from "@/lib/scope";

/** Label hero per cakupan (COPY.md "Hero dan metrik", UX-FLOWS bagian 7). */
export function heroLabel(scope: Scope, partnerName: string | null, days: number): string {
  const countdown = formatCountdown(days);
  if (scope === "partner" && partnerName) return `${partnerName}: aman dibelanjakan sampai gajian, ${countdown}`;
  if (scope === "all" && partnerName) return `Kalian berdua: aman dibelanjakan sampai gajian terdekat, ${countdown}`;
  return `Aman dibelanjakan sampai gajian, ${countdown}`;
}
