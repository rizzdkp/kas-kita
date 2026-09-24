"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { NAV_ITEMS, SETTINGS_ITEM, isActivePath, type NavItem } from "./nav-items";

type SidebarProps = {
  pathname: string;
  /** Hanya berlaku 600-1023px; di layar besar sidebar selalu terbuka. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

// radius item konsentris: radius glass bar dikurangi padding 8px
const ITEM_RADIUS = "rounded-[calc(var(--radius-glass-bar)-var(--space-2))]";

export function Sidebar({ pathname, expanded, onExpandedChange }: SidebarProps) {
  return (
    <GlassSurface
      as="nav"
      aria-label="Navigasi utama"
      data-expanded={expanded}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Escape" && expanded) onExpandedChange(false);
      }}
      className={cn(
        "fixed bottom-3 left-3 top-3 z-30 hidden flex-col gap-1 overflow-y-auto p-2 sm:flex lg:w-(--sidebar-width)",
        "transition-[width] duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none",
        expanded ? "w-(--sidebar-width)" : "w-(--sidebar-rail)",
      )}
    >
      <div className="flex h-10 items-center justify-between">
        <span className={cn("px-3 text-control font-semibold text-primary", !expanded && "hidden lg:inline")}>
          Kas Kita
        </span>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Lipat navigasi" : "Buka navigasi"}
          className={cn(
            ITEM_RADIUS,
            "inline-flex size-10 shrink-0 items-center justify-center text-secondary hover:bg-surface-sunken hover:text-primary lg:hidden",
          )}
        >
          <Icon icon={expanded ? PanelLeftClose : PanelLeftOpen} />
        </button>
      </div>

      <ul className="flex flex-col gap-1 pt-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} pathname={pathname} expanded={expanded} onNavigate={() => onExpandedChange(false)} />
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        <SidebarLink
          item={SETTINGS_ITEM}
          pathname={pathname}
          expanded={expanded}
          onNavigate={() => onExpandedChange(false)}
        />
      </div>
    </GlassSurface>
  );
}

function SidebarLink({
  item,
  pathname,
  expanded,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  expanded: boolean;
  onNavigate: () => void;
}) {
  const active = isActivePath(pathname, item.href);
  return (
    <Tooltip content={item.label} side="right" disabled={expanded} contentClassName="lg:hidden">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          ITEM_RADIUS,
          "flex h-10 items-center gap-3 px-3 text-control",
          "transition-colors duration-(--dur-fast) ease-(--ease-out)",
          active ? "glass-active text-primary" : "text-secondary hover:bg-surface-sunken hover:text-primary",
        )}
      >
        <Icon icon={item.icon} className="shrink-0" />
        <span className={cn("truncate", !expanded && "sr-only lg:not-sr-only")}>{item.label}</span>
      </Link>
    </Tooltip>
  );
}
