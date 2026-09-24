"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
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
};

export function UserMenu({ me, onSignOut, className }: UserMenuProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu akun ${me.name}`}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-pill",
          "transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-glass-active",
          className,
        )}
      >
        <Avatar name={me.name} color={me.color} size="md" labelled={false} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{me.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Settings} onSelect={() => router.push("/pengaturan")}>
          Pengaturan
        </DropdownMenuItem>
        {/* TODO(auth): koordinator menyambung onSignOut ke Better Auth; tanpa itu item nonaktif */}
        <DropdownMenuItem icon={LogOut} disabled={!onSignOut} onSelect={() => onSignOut?.()}>
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
