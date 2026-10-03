"use client";

import { useRouter } from "next/navigation";
import { Bell, LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/identity/avatar";
import { cn } from "@/components/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ShellPerson } from "./types";

type UserMenuProps = {
  me: ShellPerson;
  onSignOut?: () => void;
  className?: string;
  /** Di layar kecil tombol notifikasi tidak muat di bar atas, jadi masuk ke menu ini. */
  showNotifications?: boolean;
  notificationsUnread?: number;
};

export function UserMenu({ me, onSignOut, className, showNotifications, notificationsUnread = 0 }: UserMenuProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          showNotifications && notificationsUnread > 0
            ? `Menu akun ${me.name}, ${notificationsUnread} notifikasi belum dibaca`
            : `Menu akun ${me.name}`
        }
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-pill",
          "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-glass-active",
          className,
        )}
      >
        <span className="relative inline-flex">
          <Avatar name={me.name} color={me.color} size="md" labelled={false} />
          {showNotifications && notificationsUnread > 0 ? (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-pill bg-accent shadow-[0_0_0_2px_var(--surface)]" />
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{me.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showNotifications ? (
          <DropdownMenuItem icon={Bell} onSelect={() => router.push("/notifikasi")}>
            {notificationsUnread > 0 ? `Notifikasi (${notificationsUnread} belum dibaca)` : "Notifikasi"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem icon={Settings} onSelect={() => router.push("/pengaturan")}>
          Pengaturan
        </DropdownMenuItem>
        <DropdownMenuItem icon={LogOut} disabled={!onSignOut} onSelect={() => onSignOut?.()}>
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
