"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

export type SettingsNavItem = { id: string; label: string };

/** Navigasi anchor lengket di layar besar; bagian yang sedang terbaca ditandai lewat aria-current. */
export function SettingsAnchorNav({ items }: { items: readonly SettingsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    // garis baca di sepertiga atas layar, di bawah toolbar
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Bagian pengaturan" className="sticky top-24 hidden self-start lg:block">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex h-10 items-center rounded-md px-3 text-control text-secondary",
                "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken hover:text-primary",
                "aria-[current=location]:bg-surface aria-[current=location]:text-primary aria-[current=location]:shadow-[0_0_0_1px_var(--border)]",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Daftar bagian di layar kecil, gaya daftar pengaturan ponsel. */
export function SettingsIndexList({ items }: { items: readonly SettingsNavItem[] }) {
  return (
    <nav aria-label="Bagian pengaturan" className="lg:hidden">
      <ul className="overflow-hidden rounded-card border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id} className="border-b border-border last:border-b-0">
            <a
              href={`#${item.id}`}
              className="flex min-h-12 items-center justify-between gap-3 px-4 text-body text-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken"
            >
              {item.label}
              <Icon icon={ChevronRight} size={16} className="text-tertiary" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
