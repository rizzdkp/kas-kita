"use client";

import Link from "next/link";
import { Ellipsis, Plus } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MORE_ITEMS, NAV_ITEMS, TAB_HREFS, isActivePath, type NavItem } from "./nav-items";

type TabBarProps = {
  pathname: string;
  /** Tombol tambah di tengah; bawaan memfokuskan quick-add. */
  onAdd: () => void;
};

// radius konsentris: glass bar 22 dikurangi padding 4
const TAB_RADIUS = "rounded-[calc(var(--radius-glass-bar)-var(--space-1))]";

// label 12px di sini menyimpang dari aturan 15px di atas glass: lima tab tidak muat di 360px dengan 15px
const tabClass = (active: boolean) =>
  cn(
    TAB_RADIUS,
    "flex h-14 min-w-0 flex-col items-center justify-center gap-1 text-caption font-medium",
    "transition-colors duration-(--dur-fast) ease-(--ease-out)",
    active ? "glass-active text-primary" : "text-secondary hover:text-primary",
  );

function findItem(href: string): NavItem {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`item nav ${href} tidak ada`);
  return item;
}

export function TabBar({ pathname, onAdd }: TabBarProps) {
  const [first, second, third] = TAB_HREFS.map(findItem) as [NavItem, NavItem, NavItem];
  const moreActive = MORE_ITEMS.some((item) => isActivePath(pathname, item.href));

  return (
    <GlassSurface
      as="nav"
      aria-label="Navigasi utama"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 grid h-16 grid-cols-5 items-center p-1 sm:hidden"
    >
      <TabLink item={first} pathname={pathname} />
      <TabLink item={second} pathname={pathname} />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onAdd}
          aria-label="Catat transaksi"
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-pill bg-accent text-on-accent",
            "transition-[background-color,transform] duration-(--dur-spring) ease-(--ease-spring-glass)",
            "hover:bg-accent-hover active:scale-[1.02] motion-reduce:transition-colors",
          )}
        >
          <Icon icon={Plus} size={24} />
        </button>
      </div>
      <TabLink item={third} pathname={pathname} />
      <Sheet>
        <SheetTrigger className={tabClass(moreActive)} aria-current={moreActive ? "page" : undefined}>
          <Icon icon={Ellipsis} />
          <span>Lainnya</span>
        </SheetTrigger>
        <SheetContent title="Lainnya">
          <ul className="flex flex-col gap-1">
            {MORE_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-12 items-center gap-3 rounded-md px-3 text-control",
                        active ? "glass-active text-primary" : "text-primary hover:bg-glass-active",
                      )}
                    >
                      <Icon icon={item.icon} className="text-secondary" />
                      {item.label}
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </GlassSurface>
  );
}

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <Icon icon={item.icon} />
      <span className="max-w-full truncate px-1">{item.label}</span>
    </Link>
  );
}
