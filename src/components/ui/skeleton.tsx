import { cn } from "./cn";

/** Blok statis tanpa kilau berulang; pembungkusnya yang memberi aria-busy dan label muatan. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded-md bg-surface-sunken", className)} />;
}

export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </span>
  );
}
