import { CircleAlert, Clock } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/components/ui/cn";
import { formatCountdown } from "@/lib/dates";

// DESIGN 2.1: due-soon untuk jatuh tempo 3 hari lagi, attention hanya untuk yang telat
export const DUE_SOON_DAYS = 3;

export function dueTone(days: number): "overdue" | "soon" | "normal" {
  if (days < 0) return "overdue";
  return days <= DUE_SOON_DAYS ? "soon" : "normal";
}

export function DueCountdown({ days, className }: { days: number; className?: string }) {
  const tone = dueTone(days);
  const text = formatCountdown(days);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        tone === "overdue" ? "text-attention" : tone === "soon" ? "text-due-soon" : "text-secondary",
        className,
      )}
    >
      {tone === "overdue" ? <Icon icon={CircleAlert} size={16} /> : tone === "soon" ? <Icon icon={Clock} size={16} /> : null}
      {text.charAt(0).toUpperCase() + text.slice(1)}
    </span>
  );
}
