"use client";

import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NotificationsButtonProps = {
  /** Isi daftar notifikasi; diisi fitur notifikasi nanti. */
  children?: ReactNode;
  unread?: number;
};

export function NotificationsButton({ children, unread = 0 }: NotificationsButtonProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-secondary",
          "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-glass-active hover:text-primary",
        )}
      >
        <Icon icon={Bell} />
        {unread > 0 ? (
          <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-pill bg-accent shadow-[0_0_0_2px_var(--surface)]" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {children ?? <p className="text-control text-secondary">Belum ada notifikasi.</p>}
      </PopoverContent>
    </Popover>
  );
}
